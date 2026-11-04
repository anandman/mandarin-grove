// Pure transaction coordinator. The app injects the pinned native SQLite driver;
// tests inject a real SQLite file, never an in-memory durability substitute.
import {CREATE_JOURNAL,JOURNAL_TABLES,captureJSON,createJournal} from './journal.ts';
import type {JournalActivation,JournalContext,LocalJournal,StageJournal,AcknowledgeJournal,ApplyJournal} from './journal.ts';
export type Row=Record<string,unknown>;
export interface SQLiteDriver {
 execute(sql:string,transaction?:boolean):Promise<unknown>;
 run(sql:string,values?:any[],transaction?:boolean):Promise<unknown>;
 query(sql:string,values?:any[]):Promise<{values?:Row[]}>;
 beginTransaction():Promise<unknown>;
 commitTransaction():Promise<unknown>;
 rollbackTransaction():Promise<unknown>;
 isTransactionActive?():Promise<{result?:boolean}>;
}
export interface NativeSnapshot {revision:number;entries:Record<string,string>;registry:string|null;profiles:Record<string,string>}
export interface CommitMetadata {reason?:string;originalCode?:string;payloadHash?:string;journal?:LocalJournal}
export interface NativeDatabase {
 readSnapshot():Promise<NativeSnapshot>;
 commit(expectedRevision:number,changes:Array<[string,string|null]>,metadata?:CommitMetadata):Promise<NativeSnapshot>;
 activateJournal(input:JournalActivation):Promise<JournalContext>;
 readJournal(namespace:string):Promise<Awaited<ReturnType<ReturnType<typeof createJournal>['read']>>>;
 acknowledgeJournal(input:AcknowledgeJournal):Promise<void>;
 stageJournal(input:StageJournal):Promise<void>;
 applyJournal(input:ApplyJournal):Promise<NativeSnapshot>;
 exportRecovery():Promise<{format:string;snapshot:NativeSnapshot;originals:Row[];revisions:Row[]}>;
}
const SCHEMA=4;
const TABLES=['grove_meta','grove_entries','grove_revisions','grove_originals','grove_outbox'];
const CREATE=`
 CREATE TABLE grove_meta(id INTEGER PRIMARY KEY CHECK(id=1),schema_version INTEGER NOT NULL,revision INTEGER NOT NULL,erase_pending INTEGER NOT NULL CHECK(erase_pending IN(0,1)));
 INSERT INTO grove_meta VALUES(1,4,0,0);
 CREATE TABLE grove_entries(namespace TEXT NOT NULL,key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE grove_revisions(revision INTEGER PRIMARY KEY,reason TEXT NOT NULL,created INTEGER NOT NULL,changes_hash TEXT NOT NULL,before_json TEXT);
 CREATE TABLE grove_originals(sha256 TEXT PRIMARY KEY,code TEXT NOT NULL,payload_hash TEXT NOT NULL,created INTEGER NOT NULL,code_json TEXT NOT NULL);
 CREATE TABLE grove_outbox(operation_id TEXT PRIMARY KEY,payload TEXT NOT NULL,created INTEGER NOT NULL);
 ${CREATE_JOURNAL}
`;
const preferences=new Set(['zh_appearance','zh_voice','zh_bk']);
function namespace(key:string){
 if(preferences.has(key))return 'preferences';if(key==='zh_feedback_v1')return 'reports';
 if(key.startsWith('zh_')||key==='owenzh_v1')return 'progress';
 throw Error('Unsupported native storage key. Existing data has been kept.');
}
async function sha256(value:string){
 const bytes=new TextEncoder().encode(value),hash=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function inspectSchema(connection:Pick<SQLiteDriver,'query'>){
 const names=((await connection.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).values||[]).map(row=>String(row.name));
 let version=SCHEMA;
 if(names.includes('grove_meta')){
  const meta=(await connection.query('SELECT schema_version,revision FROM grove_meta WHERE id=1')).values||[];
  if(meta.length!==1||typeof meta[0].schema_version!=='number'||![1,2,3,SCHEMA].includes(meta[0].schema_version))throw Error('This native database uses a newer or unsupported schema. Existing files have been kept.');
  version=meta[0].schema_version;
  const required=version===SCHEMA?[...TABLES,...JOURNAL_TABLES]:TABLES;
  if(required.some(name=>!names.includes(name))||names.some(name=>!required.includes(name)&&name!=='android_metadata'))throw Error('The native database schema needs recovery. Existing files have been kept.');
  if(version>=3){
   const pending=(await connection.query('SELECT erase_pending FROM grove_meta WHERE id=1')).values?.[0]?.erase_pending;
   if(pending!==0&&pending!==1)throw Error('Native erasure metadata needs recovery. Existing files have been kept.');
  }
 }else if(names.some(name=>name!=='android_metadata'))throw Error('Unrecognized native database schema. Existing files have been kept.');
 return {names,version};
}
export async function createDatabase(connection:SQLiteDriver,{now=Date.now}: {now?:()=>number}={}):Promise<NativeDatabase>{
 // Capacitor plugins may reject with strings. Keep the UI's retry/error
 // contract identical on both operating systems and on the browser adapter.
 const native=connection;
 async function safe<T>(action:()=>Promise<T>):Promise<T>{try{return await action();}catch(error){throw error instanceof Error?error:Error(String(error));}}
 connection={
  execute:(...args)=>safe(()=>native.execute(...args)),run:(...args)=>safe(()=>native.run(...args)),query:(...args)=>safe(()=>native.query(...args)),
  beginTransaction:()=>safe(()=>native.beginTransaction()),commitTransaction:()=>safe(()=>native.commitTransaction()),rollbackTransaction:()=>safe(()=>native.rollbackTransaction()),
  ...(native.isTransactionActive?{isTransactionActive:()=>safe(()=>native.isTransactionActive!())}:{})
 };
 async function rows(sql:string,values:any[]=[]){return (await connection.query(sql,values)).values||[];}
 let recoveryError:Error|undefined;
 function requireHealthy(){if(recoveryError)throw recoveryError;}
 async function transaction<T>(action:()=>Promise<T>,guard?:()=>Promise<unknown>):Promise<T>{
  requireHealthy();
  await connection.beginTransaction();
  try{const result=await action();if(guard)await guard();await connection.commitTransaction();return result;}
  catch(error){
   try{if(!connection.isTransactionActive||(await connection.isTransactionActive()).result!==false)await connection.rollbackTransaction();}
   catch{
    // SQLITE_FULL may auto-abort before rollback. Android can then reject
    // endTransaction; iOS can also retain a stale plugin transaction flag.
    // Confirm inactivity, or use an empty begin/rollback handshake to prove
    // the connection is usable and clear that flag. This never commits data.
    try{
     if(!connection.isTransactionActive||(await connection.isTransactionActive()).result!==false){
      await connection.beginTransaction();await connection.rollbackTransaction();
      if(connection.isTransactionActive&&(await connection.isTransactionActive()).result!==false)throw Error('Unconfirmed rollback');
     }
    }catch{
     // Never let a subsequent read present this handle's uncommitted writes
     // as saved progress. Only reopening/recovering the database can clear it.
     recoveryError=Error('The native transaction needs recovery. Existing database files have been kept.');
     throw recoveryError;
    }
   }
   throw error;
  }
 }
 async function finishErasure(){
  try{
   const marker=(await rows('SELECT revision,erase_pending FROM grove_meta WHERE id=1'))[0];
   if(marker?.erase_pending===0)return; // Another recovery connection finished it.
   if(marker?.erase_pending!==1)throw Error('Invalid erasure marker');
   const remaining=(await rows('SELECT (SELECT count(*) FROM grove_entries)+(SELECT count(*) FROM grove_originals)+(SELECT count(*) FROM grove_outbox)+(SELECT count(*) FROM grove_revisions WHERE before_json IS NOT NULL)'+JOURNAL_TABLES.filter(t=>t!=='grove_sync_binding').map(t=>'+(SELECT count(*) FROM '+t+')').join('')+'+(SELECT count(*) FROM grove_sync_binding WHERE namespace IS NOT NULL OR installation_id IS NOT NULL OR enabled<>0) AS remaining'))[0]?.remaining;
   if(remaining!==0)throw Error('Unexpected data after erasure');
   // secure_delete handles this transaction's cells. VACUUM also removes
   // free pages left by older versions, then TRUNCATE drops old WAL frames.
   // Neither operation touches OS-selected external backup files.
   await connection.execute('VACUUM',false);
   const checkpoint=(await rows('PRAGMA wal_checkpoint(TRUNCATE)'))[0];
   if(checkpoint?.busy!==0||checkpoint?.log!==0||checkpoint?.checkpointed!==0)throw Error('Erasure checkpoint is busy or unavailable');
   // Clearing this device-private flag writes only anonymous metadata. All
   // earlier learner frames have already been purged, even if this ACK is lost.
   await connection.run('UPDATE grove_meta SET erase_pending=0 WHERE id=1 AND revision=? AND erase_pending=1',[marker.revision],false);
   if((await rows('SELECT erase_pending FROM grove_meta WHERE id=1'))[0]?.erase_pending!==0)throw Error('A newer erasure is pending');
  }catch{
   recoveryError=Error('Device erasure is incomplete. Restart the app to finish before using progress. External backup files were kept.');
   throw recoveryError;
  }
 }
 const {names,version}=await inspectSchema(connection);
 let erasureSchema=version>=3;
 // Android execSQL refuses row-returning PRAGMAs. Use the driver's query API
 // for each setting, then require the durability settings actually in force.
 await rows('PRAGMA journal_mode=WAL');
 await rows('PRAGMA synchronous=FULL');
 await rows('PRAGMA busy_timeout=5000');
 if(String((await rows('PRAGMA journal_mode'))[0]?.journal_mode).toLowerCase()!=='wal'||
    (await rows('PRAGMA synchronous'))[0]?.synchronous!==2||
    (await rows('PRAGMA busy_timeout'))[0]?.timeout!==5000)throw Error('Native durable storage settings could not be applied. Existing files have been kept.');
 if(!names.includes('grove_meta'))await transaction(()=>connection.execute(CREATE,false));
 if(version<SCHEMA){
  // Keep every legacy column. Native UTF-16 binding removes a leading BOM,
  // so store a JSON string (opening quote first) as the authoritative code.
  // A legacy missing BOM is recoverable only against its pre-existing hash.
  await transaction(async()=>{
   const before=await snapshot(true),originals=version===1?await rows('SELECT sha256,code FROM grove_originals'):[],encoded=[];
   const legacyErasure=version<3?(await rows('SELECT reason FROM grove_revisions ORDER BY revision DESC LIMIT 1'))[0]?.reason==='erase':(await rows('SELECT erase_pending FROM grove_meta WHERE id=1'))[0]?.erase_pending===1;
   for(const row of originals){
    let code=String(row.code);
    if(await sha256(code)!==row.sha256){
     if(await sha256('\ufeff'+code)!==row.sha256)throw Error('An original backup hash needs recovery. Every legacy row has been kept.');
     code='\ufeff'+code;
    }
    encoded.push([JSON.stringify(code),row.sha256]);
   }
   if(before.revision===Number.MAX_SAFE_INTEGER)throw Error('Native progress revision needs an upgrade.');
   if(version===1){
    await connection.execute('ALTER TABLE grove_originals ADD COLUMN code_json TEXT;',false);
    for(const values of encoded)await connection.run('UPDATE grove_originals SET code_json=? WHERE sha256=?',values,false);
   }
   if(version<3)await connection.execute('ALTER TABLE grove_meta ADD COLUMN erase_pending INTEGER NOT NULL DEFAULT 0 CHECK(erase_pending IN(0,1));',false);
   await connection.execute(CREATE_JOURNAL,false);
   await connection.run('INSERT INTO grove_revisions(revision,reason,created,changes_hash,before_json) VALUES(?,?,?,?,?)',[before.revision+1,'upgrade',now(),await sha256('schema:'+version+'->4:sync-journal'),legacyErasure?null:JSON.stringify(before)],false);
   await connection.run('UPDATE grove_meta SET schema_version=4,revision=?,erase_pending=? WHERE id=1',[before.revision+1,legacyErasure?1:0],false);
  });
  erasureSchema=true;
 }
 const pending=(await rows('SELECT erase_pending FROM grove_meta WHERE id=1'))[0]?.erase_pending;
 if(pending!==0&&pending!==1)throw Error('Native erasure metadata needs recovery. Existing files have been kept.');
 // The independent flag survives kills and lost COMMIT acknowledgements.
 // Finish cleanup before constructing a repository or creating a new profile.
 if(pending===1)await finishErasure();
 let tail:Promise<unknown>=Promise.resolve();
 function serial<T>(action:()=>Promise<T>):Promise<T>{const result=tail.then(action);tail=result.then(()=>undefined,()=>undefined);return result;}
 const journal=createJournal({connection,rows,hash:sha256,now});
 async function snapshot(allowErasure=false):Promise<NativeSnapshot>{
  requireHealthy();
  const data=await rows('SELECT m.revision,'+(erasureSchema?'m.erase_pending':'0 AS erase_pending')+',e.namespace,e.key,e.value FROM grove_meta m LEFT JOIN grove_entries e ON 1=1 WHERE m.id=1 ORDER BY e.key');
  if(data[0]?.erase_pending!==0){
   if(data[0]?.erase_pending!==1)throw Error('Native erasure metadata needs recovery. Existing files have been kept.');
   if(!allowErasure)throw Error('Device erasure is incomplete. Restart the app to finish before using progress. External backup files were kept.');
  }
  const revision=data[0]?.revision;
  if(typeof revision!=='number'||!Number.isSafeInteger(revision)||revision<0)throw Error('Native progress metadata needs recovery.');
  const entries=Object.fromEntries(data.filter(row=>row.key!==null).map(row=>{
   if(typeof row.key!=='string'||typeof row.value!=='string'||row.namespace!==namespace(row.key))throw Error('Native progress contains an unsupported value. Existing data has been kept.');
   return [row.key,row.value];
  })) as Record<string,string>;
  return {revision,entries,registry:entries.zh_profiles??null,profiles:Object.fromEntries(Object.entries(entries).filter(([key])=>key.startsWith('zh_p_')).map(([key,value])=>[key.slice(5),value]))};
 }
 async function originalCode(row:Row){
  let code;try{code=JSON.parse(String(row.code_json));}catch{throw Error('Original backup encoding needs recovery. Existing files have been kept.');}
  if(typeof code!=='string'||await sha256(code)!==row.sha256)throw Error('Original backup hash needs recovery. Existing files have been kept.');
  return code;
 }
 return {
  readSnapshot:()=>serial(snapshot),
  activateJournal(input){
   const token=journal.invalidate();let captured:JournalActivation;
   try{captured=captureJSON(input);}catch(error){return Promise.reject(error);}
   return serial(()=>transaction(async()=>{await snapshot();return journal.activate(captured,token);}));
  },
  readJournal:namespace=>serial(()=>transaction(async()=>{await snapshot();return journal.read(namespace);})),
  acknowledgeJournal(input){let captured:AcknowledgeJournal;try{captured=captureJSON(input);}catch(error){return Promise.reject(error);}return serial(()=>transaction(async()=>{await snapshot();return journal.acknowledge(captured);},()=>journal.guard(captured.context)));},
  stageJournal(input){let captured:StageJournal;try{captured=captureJSON(input);}catch(error){return Promise.reject(error);}return serial(()=>transaction(async()=>{await snapshot();return journal.stage(captured);},()=>journal.guard(captured.context)));},
  applyJournal(input){
   let captured:ApplyJournal;try{captured=captureJSON(input);for(const [key,value]of captured.changes){if(namespace(key)!=='progress'||(value!==null&&typeof value!=='string'))throw Error('Remote projection cannot change device preferences or reports');}if(new Set(captured.changes.map(([key])=>key)).size!==captured.changes.length)throw Error('Duplicate remote change');}catch(error){return Promise.reject(error);}
   return serial(()=>transaction(async()=>{
    const state=await journal.prepareApply(captured),before=await snapshot();
    if(before.revision!==captured.expectedRevision)throw Error('Native progress revision changed. Reload before applying cloud changes.');
    if(before.revision===Number.MAX_SAFE_INTEGER)throw Error('Native progress revision needs an upgrade.');
    for(const [key,value]of captured.changes){if(value===null)await connection.run('DELETE FROM grove_entries WHERE key=?',[key],false);else await connection.run('INSERT INTO grove_entries(namespace,key,value) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET namespace=excluded.namespace,value=excluded.value',[namespace(key),key,value],false);}
    await connection.run('INSERT INTO grove_revisions(revision,reason,created,changes_hash,before_json) VALUES(?,?,?,?,?)',[before.revision+1,'sync',now(),await sha256(JSON.stringify(captured.changes)),JSON.stringify(before)],false);
    await connection.run('UPDATE grove_meta SET revision=? WHERE id=1',[before.revision+1],false);
    await journal.finishApply(captured,state);return snapshot();
   },()=>journal.guard(captured.context)));
  },
  commit(expectedRevision,changes,metadata={}){
   // Capture data before queuing and validate all keys before touching SQLite.
   let captured:Array<[string,string|null]>,meta:CommitMetadata;
   try{
    captured=changes.map(([key,value])=>{namespace(key);if(value!==null&&typeof value!=='string')throw Error('Invalid native change');return [key,value];});
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||new Set(captured.map(([key])=>key)).size!==captured.length)throw Error('Invalid native revision or duplicate change');
    meta=captureJSON(metadata);if(meta.originalCode!==undefined&&(typeof meta.originalCode!=='string'||!/^[a-f0-9]{64}$/.test(meta.payloadHash||'')))throw Error('Original backup hash binding is missing');
   }catch(error){return Promise.reject(error);}
   if(meta.reason==='erase')journal.invalidate();
   return serial(async()=>{
    const changesHash=await sha256(JSON.stringify(captured)),originalHash=meta.originalCode===undefined?null:await sha256(meta.originalCode);
    const reason=meta.reason||'save';
    if(reason==='erase'){
     requireHealthy();
     if(captured.some(([,value])=>value!==null)||originalHash||meta.journal)throw Error('An erase cannot also save progress. Existing data has been kept.');
     await rows('PRAGMA secure_delete=ON');
     if((await rows('PRAGMA secure_delete'))[0]?.secure_delete!==1)throw Error('Could not prepare private erasure. Progress has been kept.');
    }
    const saved=await transaction(async()=>{
     const fingerprint=meta.journal?await sha256(JSON.stringify({expectedRevision,changes:captured,metadata:meta})):null;
     const local=meta.journal?await journal.prepareLocal(meta.journal,fingerprint!):null;
     if(local?.retry)return snapshot();
     const before=await snapshot();if(before.revision!==expectedRevision)throw Error('Native progress revision changed. Reload before saving again.');
     if(before.revision===Number.MAX_SAFE_INTEGER)throw Error('Native progress revision needs an upgrade.');
     const revision=before.revision+1;
     if(reason==='erase'){
      await connection.run('DELETE FROM grove_entries',[],false);
      await connection.run('DELETE FROM grove_revisions',[],false);await connection.run('DELETE FROM grove_originals',[],false);await connection.run('DELETE FROM grove_outbox',[],false);
      await journal.erase();
     }
     for(const [key,value]of captured){
      if(value===null)await connection.run('DELETE FROM grove_entries WHERE key=?',[key],false);
      else await connection.run('INSERT INTO grove_entries(namespace,key,value) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET namespace=excluded.namespace,value=excluded.value',[namespace(key),key,value],false);
     }
     if(originalHash){
      const original=await rows('SELECT sha256,code_json,payload_hash FROM grove_originals WHERE sha256=?',[originalHash]);
      if(original.length&&(await originalCode(original[0])!==meta.originalCode||original[0].payload_hash!==meta.payloadHash))throw Error('Original backup hash binding changed');
      await connection.run('INSERT OR IGNORE INTO grove_originals(sha256,code,payload_hash,created,code_json) VALUES(?,?,?,?,?)',[originalHash,meta.originalCode,meta.payloadHash,now(),JSON.stringify(meta.originalCode)],false);
     }
     const keepBefore=['import','reset','delete','bootstrap','upgrade'].includes(reason);
     await connection.run('INSERT INTO grove_revisions(revision,reason,created,changes_hash,before_json) VALUES(?,?,?,?,?)',[revision,reason,now(),changesHash,keepBefore?JSON.stringify(before):null],false);
     await connection.run('UPDATE grove_meta SET revision=?,erase_pending=? WHERE id=1',[revision,reason==='erase'?1:0],false);
     if(meta.journal&&local)await journal.appendLocal(meta.journal,fingerprint!,local);
     return snapshot(reason==='erase');
    });
    if(reason==='erase'){await finishErasure();return snapshot();}
    return saved;
   });
  },
  exportRecovery:()=>serial(()=>transaction(async()=>({
   format:'mandarin-grove-native-recovery-v1',snapshot:await snapshot(),
   originals:await Promise.all((await rows('SELECT sha256,code_json,payload_hash,created FROM grove_originals ORDER BY sha256')).map(async row=>({sha256:row.sha256,code:await originalCode(row),payloadHash:row.payload_hash,created:row.created}))),
   revisions:(await rows('SELECT revision,reason,created,changes_hash,before_json FROM grove_revisions ORDER BY revision')).map(row=>({revision:row.revision,reason:row.reason,created:row.created,changesHash:row.changes_hash,before:row.before_json===null?null:JSON.parse(String(row.before_json))})),
   journal:await journal.recovery()
  })))
 };
}
