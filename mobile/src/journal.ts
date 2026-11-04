import type {Row,SQLiteDriver} from './database.ts';

// This is a durable transport journal, not the learner-event projector or an
// authentication boundary. Providers must bind account scope outside wire data.
export const JOURNAL_TABLES=['grove_sync_binding','grove_sync_states','grove_sync_operations','grove_sync_batches'];
export const CREATE_JOURNAL=`
 CREATE TABLE grove_sync_binding(id INTEGER PRIMARY KEY CHECK(id=1),namespace TEXT,installation_id TEXT,epoch INTEGER NOT NULL,enabled INTEGER NOT NULL CHECK(enabled IN(0,1)));
 INSERT INTO grove_sync_binding VALUES(1,NULL,NULL,0,0);
 CREATE TABLE grove_sync_states(namespace TEXT NOT NULL,installation_id TEXT NOT NULL,actor_id TEXT NOT NULL,counter INTEGER NOT NULL,revision INTEGER NOT NULL,projected_revision INTEGER NOT NULL,cursor_json TEXT NOT NULL,pending_cursor_json TEXT NOT NULL,pending INTEGER NOT NULL CHECK(pending IN(0,1)),PRIMARY KEY(namespace,installation_id));
 CREATE TABLE grove_sync_operations(namespace TEXT NOT NULL,sha256 TEXT NOT NULL,expected_hash TEXT NOT NULL,operation_id TEXT,raw_json TEXT NOT NULL,validation TEXT NOT NULL,acknowledged INTEGER NOT NULL CHECK(acknowledged IN(0,1)),created INTEGER NOT NULL,PRIMARY KEY(namespace,sha256,expected_hash));
 CREATE TABLE grove_sync_batches(namespace TEXT NOT NULL,batch_id TEXT NOT NULL,fingerprint TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(namespace,batch_id));
 ALTER TABLE grove_outbox ADD COLUMN namespace TEXT;
 ALTER TABLE grove_outbox ADD COLUMN payload_hash TEXT;
`;
export interface JournalContext {namespace:string;epoch:number;generation:string;enabled:boolean}
export interface JournalActivation {namespace:string;installationId:string;actorId:string;enabled:boolean}
export interface LocalJournal {namespace:string;installationId:string;actorId:string;expectedCounter:number;batchId:string;records:string[]}
export interface StageJournal {context:JournalContext;records:Array<{raw:string;sha256?:string}>;cursor:unknown}
export interface AcknowledgeJournal {context:JournalContext;receipts:Array<{id:string;sha256:string}>}
export interface ApplyJournal {context:JournalContext;expectedRevision:number;expectedJournalRevision:number;changes:Array<[string,string|null]>}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hashPattern=/^[a-f0-9]{64}$/;
const kinds=new Set(['legacyImport','profileCreate','profileSettings','answerRecorded','retryRecorded','roundCheckpoint','roundComplete','sentenceClaim','walletPurchase','walletRefund','draftSave','selectionChange','profileDelete']);
const object=(v:unknown):v is Record<string,any>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const natural=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
function increment(v:unknown){if(!natural(v)||v===Number.MAX_SAFE_INTEGER)throw Error('Journal counter needs recovery.');return v+1;}
function scope(v:unknown):asserts v is string{if(typeof v!=='string'||!v.length||v.length>512||v.includes('\0'))throw Error('Invalid journal namespace');}
function id(v:unknown):asserts v is string{if(typeof v!=='string'||!uuid.test(v))throw Error('Invalid journal identity');}
export function captureJSON<T>(value:T):T{return JSON.parse(JSON.stringify(value));}
function envelope(raw:string):{value?:Record<string,any>;validation:string}{
 try{
  if(new TextDecoder('utf-8',{ignoreBOM:true}).decode(new TextEncoder().encode(raw))!==raw)return {validation:'invalid-utf8'};
  const value=JSON.parse(raw.startsWith('\ufeff')?raw.slice(1):raw);
  if(!object(value))return {validation:'invalid-envelope'};
  if(value.schema!==1||value.policyVersion!==1)return {value,validation:'unsupported-version'};
  if(!uuid.test(value.id)||!uuid.test(value.deviceId)||!uuid.test(value.profileUuid)||!natural(value.counter)||value.counter===0||
     !Array.isArray(value.parents)||value.parents.some((p:unknown)=>typeof p!=='string'||!uuid.test(p)||p===value.id)||new Set(value.parents).size!==value.parents.length||
     !kinds.has(value.kind)||!Number.isSafeInteger(value.at)||!object(value.payload))return {value,validation:'invalid-envelope'};
  return {value,validation:'supported'};
 }catch{return {validation:'invalid-json'};}
}
export function createJournal({connection,rows,hash,now}: {connection:SQLiteDriver;rows:(sql:string,values?:any[])=>Promise<Row[]>;hash:(s:string)=>Promise<string>;now:()=>number}){
 let generation=crypto.randomUUID();
 const invalidate=()=>{generation=crypto.randomUUID();return generation;};
 async function binding(){const row=(await rows('SELECT * FROM grove_sync_binding WHERE id=1'))[0];if(!row||!natural(row.epoch)||(row.enabled!==0&&row.enabled!==1))throw Error('Journal binding needs recovery');return row;}
 async function state(namespace:string,installationId?:string){
  const result=await rows('SELECT * FROM grove_sync_states WHERE namespace=?'+(installationId?' AND installation_id=?':' ORDER BY rowid DESC LIMIT 1'),installationId?[namespace,installationId]:[namespace]);
  const row=result[0];if(!row||!natural(row.counter)||!natural(row.revision)||!natural(row.projected_revision))throw Error('Journal state needs recovery');return row;
 }
 async function guard(context:JournalContext){
  if(!context||context.generation!==generation||context.enabled!==true)throw Error('Journal account context changed');
  const row=await binding();
  if(context.generation!==generation||row.namespace!==context.namespace||row.epoch!==context.epoch||row.enabled!==1)throw Error('Journal account context changed');
  return state(context.namespace,String(row.installation_id));
 }
 async function activate(input:JournalActivation,token:string){
  scope(input.namespace);id(input.installationId);id(input.actorId);if(typeof input.enabled!=='boolean'||token!==generation)throw Error('Journal activation changed');
  const previous=await binding(),epoch=increment(previous.epoch);
  const existing=await rows('SELECT * FROM grove_sync_states WHERE namespace=? AND installation_id=?',[input.namespace,input.installationId]);
  if(existing.length&&existing[0].actor_id!==input.actorId)throw Error('An installation cannot reuse a different journal actor');
  if(!existing.length){
   const history=await rows('SELECT 1 FROM grove_sync_states WHERE namespace=? AND actor_id=?',[input.namespace,input.actorId]);
   const received=(await records(input.namespace)).some(row=>envelope(row.raw).value?.deviceId===input.actorId);
   if(history.length||received)throw Error('A new installation requires a fresh journal actor');
  }
  if(!existing.length)await connection.run('INSERT INTO grove_sync_states VALUES(?,?,?,?,?,?,?,?,?)',[input.namespace,input.installationId,input.actorId,0,0,0,'null','null',0],false);
  await connection.run('UPDATE grove_sync_binding SET namespace=?,installation_id=?,epoch=?,enabled=? WHERE id=1',[input.namespace,input.installationId,epoch,input.enabled?1:0],false);
  if(token!==generation)throw Error('Journal activation changed');
  return {namespace:input.namespace,epoch,generation:token,enabled:input.enabled};
 }
 async function records(namespace:string):Promise<Array<Row&{id:unknown;raw:string;acknowledged:boolean}>>{return (await rows('SELECT * FROM grove_sync_operations WHERE namespace=? ORDER BY sha256,expected_hash',[namespace])).map(row=>{
  const raw=JSON.parse(String(row.raw_json));if(typeof raw!=='string')throw Error('Journal raw bytes need recovery');
  return {...row,id:row.operation_id,raw,acknowledged:row.acknowledged===1};
 });}
 async function read(namespace:string){
  scope(namespace);const b=await binding(),active=b.namespace===namespace;
  const found=await rows('SELECT * FROM grove_sync_states WHERE namespace=?'+(active?' AND installation_id=?':' ORDER BY rowid DESC LIMIT 1'),active?[namespace,b.installation_id]:[namespace]);
  const s=found[0];
  return {context:active?{namespace,epoch:Number(b.epoch),generation,enabled:b.enabled===1}:null,
   state:s?{actorId:s.actor_id,installationId:s.installation_id,counter:s.counter,revision:s.revision,projectedRevision:s.projected_revision,cursor:JSON.parse(String(s.cursor_json)),pendingCursor:JSON.parse(String(s.pending_cursor_json)),history:await rows('SELECT * FROM grove_sync_states WHERE namespace=? ORDER BY rowid',[namespace])}:null,
   records:await records(namespace),outbox:(await rows('SELECT * FROM grove_outbox WHERE namespace=? ORDER BY operation_id',[namespace])).map(row=>({...row,id:row.operation_id,sha256:row.payload_hash}))};
 }
 async function prepareLocal(j:LocalJournal,fingerprint:string){
  scope(j.namespace);id(j.installationId);id(j.actorId);id(j.batchId);
  if(!natural(j.expectedCounter)||!Array.isArray(j.records)||!j.records.length||j.records.some(raw=>typeof raw!=='string'))throw Error('Invalid local journal batch');
  const batch=(await rows('SELECT fingerprint FROM grove_sync_batches WHERE namespace=? AND batch_id=?',[j.namespace,j.batchId]))[0];
  if(batch){if(batch.fingerprint!==fingerprint)throw Error('Journal batch identity changed');return {retry:true};}
  const s=await state(j.namespace,j.installationId);if(s.actor_id!==j.actorId||s.counter!==j.expectedCounter)throw Error('Journal actor counter changed');
  const seenCounters=new Set((await records(j.namespace)).map(row=>envelope(row.raw).value).filter(op=>op?.deviceId===j.actorId).map(op=>op!.counter));
  let counter=j.expectedCounter;const prepared:Array<{raw:string;id:string;digest:string}>=[];
  for(const raw of j.records){
   const decoded=envelope(raw),op=decoded.value;
   if(decoded.validation!=='supported'||!op||op.deviceId!==j.actorId||op.counter!==increment(counter))throw Error('Invalid local operation envelope or counter');
   if(seenCounters.has(op.counter))throw Error('Journal actor counter already exists');
   counter=op.counter;
   const digest=await hash(raw);
   if(prepared.some(p=>p.id===op.id)||(await rows('SELECT 1 FROM grove_sync_operations WHERE namespace=? AND operation_id=?',[j.namespace,op.id])).length||
      (await rows('SELECT 1 FROM grove_outbox WHERE operation_id=?',[op.id])).length)throw Error('Journal operation identity already exists');
   prepared.push({raw,id:op.id,digest});
  }
  return {retry:false,s,counter,prepared};
 }
 async function appendLocal(j:LocalJournal,fingerprint:string,prepared:Awaited<ReturnType<typeof prepareLocal>>){
  if(prepared.retry||!prepared.s||!prepared.prepared)throw Error('Invalid local journal append');
  for(const p of prepared.prepared){
   await connection.run('INSERT INTO grove_sync_operations VALUES(?,?,?,?,?,?,?,?)',[j.namespace,p.digest,'',p.id,JSON.stringify(p.raw),'supported',0,now()],false);
   // payload is wrapped too: native UTF16 binding may otherwise discard a BOM.
   await connection.run('INSERT INTO grove_outbox(operation_id,payload,created,namespace,payload_hash) VALUES(?,?,?,?,?)',[p.id,JSON.stringify(p.raw),now(),j.namespace,p.digest],false);
  }
  await connection.run('UPDATE grove_sync_states SET counter=?,revision=? WHERE namespace=? AND installation_id=?',[prepared.counter,increment(prepared.s.revision),j.namespace,j.installationId],false);
  await connection.run('INSERT INTO grove_sync_batches VALUES(?,?,?,?)',[j.namespace,j.batchId,fingerprint,now()],false);
 }
 async function acknowledge(input:AcknowledgeJournal){
  const s=await guard(input.context);if(!Array.isArray(input.receipts)||new Set(input.receipts.map(r=>r.id)).size!==input.receipts.length)throw Error('Invalid journal receipts');
  for(const receipt of input.receipts){
   id(receipt.id);if(!hashPattern.test(receipt.sha256))throw Error('Invalid journal receipt hash');
   const found=await rows('SELECT * FROM grove_sync_operations WHERE namespace=? AND operation_id=?',[input.context.namespace,receipt.id]);
   if(found.length!==1||found[0].sha256!==receipt.sha256||found[0].validation!=='supported')throw Error('Journal delivery receipt does not match original bytes');
   await connection.run('UPDATE grove_sync_operations SET acknowledged=1 WHERE namespace=? AND operation_id=? AND sha256=?',[input.context.namespace,receipt.id,receipt.sha256],false);
   await connection.run('DELETE FROM grove_outbox WHERE namespace=? AND operation_id=? AND payload_hash=?',[input.context.namespace,receipt.id,receipt.sha256],false);
  }
  if(input.receipts.length)await connection.run('UPDATE grove_sync_states SET revision=? WHERE namespace=? AND installation_id=?',[increment(s.revision),s.namespace,s.installation_id],false);
  await guard(input.context);
 }
 async function stage(input:StageJournal){
  const s=await guard(input.context);if(!Array.isArray(input.records))throw Error('Invalid journal receive batch');
  for(const record of input.records){
   if(typeof record.raw!=='string'||(record.sha256!==undefined&&typeof record.sha256!=='string'))throw Error('Invalid received journal bytes');
   const digest=await hash(record.raw),decoded=envelope(record.raw),expected=record.sha256&&record.sha256!==digest?record.sha256:'';
   const validation=expected&&expected!==digest?'hash-mismatch':decoded.validation;
   const old=(await rows('SELECT raw_json FROM grove_sync_operations WHERE namespace=? AND sha256=? AND expected_hash=?',[input.context.namespace,digest,expected]))[0];
   if(old&&JSON.parse(String(old.raw_json))!==record.raw)throw Error('Journal hash collision needs recovery');
   await connection.run('INSERT INTO grove_sync_operations VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(namespace,sha256,expected_hash) DO UPDATE SET acknowledged=1',[input.context.namespace,digest,expected,typeof decoded.value?.id==='string'?decoded.value.id:null,JSON.stringify(record.raw),validation,1,now()],false);
   await guard(input.context);
  }
  await connection.run('UPDATE grove_sync_states SET revision=?,pending_cursor_json=?,pending=1 WHERE namespace=? AND installation_id=?',[increment(s.revision),JSON.stringify(input.cursor),s.namespace,s.installation_id],false);
  await guard(input.context);
 }
 async function prepareApply(input:ApplyJournal){
  const s=await guard(input.context);if(s.revision!==input.expectedJournalRevision)throw Error('Journal receive revision changed');
  const all=await records(input.context.namespace),byId=new Map<string,Record<string,any>>(),counters=new Map<string,Set<number>>();
  for(const record of all){
   const decoded=envelope(record.raw),op=decoded.value;
   if(record.validation!=='supported'||decoded.validation!=='supported'||!op||await hash(record.raw)!==record.sha256)throw Error('Journal contains unsupported or damaged operations');
   const previous=byId.get(op.id);if(previous){if(previous.raw!==record.raw)throw Error('Journal contains conflicting operation identities');continue;}
   byId.set(op.id,{...op,raw:record.raw});
   const seen=counters.get(op.deviceId)||new Set<number>();if(seen.has(op.counter))throw Error('Journal actor counter conflicts');seen.add(op.counter);counters.set(op.deviceId,seen);
  }
  for(const seen of counters.values()){let max=0;for(const counter of seen)max=Math.max(max,counter);if(max!==seen.size)throw Error('Journal actor history is incomplete');}
  const visited=new Set<string>(),visiting=new Set<string>();
  function visit(key:string){if(visited.has(key))return;if(visiting.has(key))throw Error('Journal parents contain a cycle');const op=byId.get(key);if(!op)throw Error('Journal parent is missing');visiting.add(key);for(const parent of op.parents)visit(parent);visiting.delete(key);visited.add(key);}
  for(const key of byId.keys())visit(key);
  return s;
 }
 async function finishApply(input:ApplyJournal,s:Row){
  await guard(input.context);
  await connection.run('UPDATE grove_sync_states SET cursor_json=CASE WHEN pending=1 THEN pending_cursor_json ELSE cursor_json END,pending_cursor_json=?,pending=0,projected_revision=revision WHERE namespace=? AND installation_id=?',['null',s.namespace,s.installation_id],false);
 }
 async function erase(){
  const b=await binding(),epoch=increment(b.epoch);
  for(const table of JOURNAL_TABLES.filter(t=>t!=='grove_sync_binding'))await connection.run('DELETE FROM '+table,[],false);
  await connection.run('UPDATE grove_sync_binding SET namespace=NULL,installation_id=NULL,epoch=?,enabled=0 WHERE id=1',[epoch],false);
 }
 async function recovery(){return {binding:await rows('SELECT * FROM grove_sync_binding'),states:await rows('SELECT * FROM grove_sync_states ORDER BY namespace,installation_id'),records:await Promise.all((await rows('SELECT DISTINCT namespace FROM grove_sync_operations ORDER BY namespace')).map(async row=>({namespace:row.namespace,records:await records(String(row.namespace))}))),batches:await rows('SELECT * FROM grove_sync_batches ORDER BY namespace,batch_id'),outbox:await rows('SELECT * FROM grove_outbox ORDER BY operation_id')};}
 return {invalidate,guard,activate,read,prepareLocal,appendLocal,acknowledge,stage,prepareApply,finishApply,erase,recovery};
}
