// Pure transaction coordinator. The app injects the pinned native SQLite driver;
// tests inject a real SQLite file, never an in-memory durability substitute.
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
export interface CommitMetadata {reason?:string;originalCode?:string;payloadHash?:string}
export interface NativeDatabase {
 readSnapshot():Promise<NativeSnapshot>;
 commit(expectedRevision:number,changes:Array<[string,string|null]>,metadata?:CommitMetadata):Promise<NativeSnapshot>;
 exportRecovery():Promise<{format:string;snapshot:NativeSnapshot;originals:Row[];revisions:Row[]}>;
}
const SCHEMA=2;
const TABLES=['grove_meta','grove_entries','grove_revisions','grove_originals','grove_outbox'];
const CREATE=`
 CREATE TABLE grove_meta(id INTEGER PRIMARY KEY CHECK(id=1),schema_version INTEGER NOT NULL,revision INTEGER NOT NULL);
 INSERT INTO grove_meta VALUES(1,2,0);
 CREATE TABLE grove_entries(namespace TEXT NOT NULL,key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE grove_revisions(revision INTEGER PRIMARY KEY,reason TEXT NOT NULL,created INTEGER NOT NULL,changes_hash TEXT NOT NULL,before_json TEXT);
 CREATE TABLE grove_originals(sha256 TEXT PRIMARY KEY,code TEXT NOT NULL,payload_hash TEXT NOT NULL,created INTEGER NOT NULL,code_json TEXT NOT NULL);
 CREATE TABLE grove_outbox(operation_id TEXT PRIMARY KEY,payload TEXT NOT NULL,created INTEGER NOT NULL);
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
  if(meta.length!==1||typeof meta[0].schema_version!=='number'||![1,SCHEMA].includes(meta[0].schema_version))throw Error('This native database uses a newer or unsupported schema. Existing files have been kept.');
  version=meta[0].schema_version;
  if(TABLES.some(name=>!names.includes(name))||names.some(name=>!TABLES.includes(name)&&name!=='android_metadata'))throw Error('The native database schema needs recovery. Existing files have been kept.');
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
 async function transaction<T>(action:()=>Promise<T>):Promise<T>{
  requireHealthy();
  await connection.beginTransaction();
  try{const result=await action();await connection.commitTransaction();return result;}
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
 const {names,version}=await inspectSchema(connection);
 // Android execSQL refuses row-returning PRAGMAs. Use the driver's query API
 // for each setting, then require the durability settings actually in force.
 await rows('PRAGMA journal_mode=WAL');
 await rows('PRAGMA synchronous=FULL');
 await rows('PRAGMA busy_timeout=5000');
 if(String((await rows('PRAGMA journal_mode'))[0]?.journal_mode).toLowerCase()!=='wal'||
    (await rows('PRAGMA synchronous'))[0]?.synchronous!==2||
    (await rows('PRAGMA busy_timeout'))[0]?.timeout!==5000)throw Error('Native durable storage settings could not be applied. Existing files have been kept.');
 if(!names.includes('grove_meta'))await transaction(()=>connection.execute(CREATE,false));
 if(version===1){
  // Keep every legacy column. Native UTF-16 binding removes a leading BOM,
  // so store a JSON string (opening quote first) as the authoritative code.
  // A legacy missing BOM is recoverable only against its pre-existing hash.
  await transaction(async()=>{
   const before=await snapshot(),originals=await rows('SELECT sha256,code FROM grove_originals'),encoded=[];
   for(const row of originals){
    let code=String(row.code);
    if(await sha256(code)!==row.sha256){
     if(await sha256('\ufeff'+code)!==row.sha256)throw Error('An original backup hash needs recovery. Every legacy row has been kept.');
     code='\ufeff'+code;
    }
    encoded.push([JSON.stringify(code),row.sha256]);
   }
   if(before.revision===Number.MAX_SAFE_INTEGER)throw Error('Native progress revision needs an upgrade.');
   await connection.execute('ALTER TABLE grove_originals ADD COLUMN code_json TEXT;',false);
   for(const values of encoded)await connection.run('UPDATE grove_originals SET code_json=? WHERE sha256=?',values,false);
   await connection.run('INSERT INTO grove_revisions(revision,reason,created,changes_hash,before_json) VALUES(?,?,?,?,?)',[before.revision+1,'upgrade',now(),await sha256('schema:1->2:original-code-json'),JSON.stringify(before)],false);
   await connection.run('UPDATE grove_meta SET schema_version=2,revision=? WHERE id=1',[before.revision+1],false);
  });
 }
 let tail:Promise<unknown>=Promise.resolve();
 function serial<T>(action:()=>Promise<T>):Promise<T>{const result=tail.then(action);tail=result.then(()=>undefined,()=>undefined);return result;}
 async function snapshot():Promise<NativeSnapshot>{
  requireHealthy();
  const data=await rows('SELECT m.revision,e.namespace,e.key,e.value FROM grove_meta m LEFT JOIN grove_entries e ON 1=1 WHERE m.id=1 ORDER BY e.key');
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
  commit(expectedRevision,changes,metadata={}){
   // Capture data before queuing and validate all keys before touching SQLite.
   let captured:Array<[string,string|null]>,meta:CommitMetadata;
   try{
    captured=changes.map(([key,value])=>{namespace(key);if(value!==null&&typeof value!=='string')throw Error('Invalid native change');return [key,value];});
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||new Set(captured.map(([key])=>key)).size!==captured.length)throw Error('Invalid native revision or duplicate change');
    meta={...metadata};if(meta.originalCode!==undefined&&(typeof meta.originalCode!=='string'||!/^[a-f0-9]{64}$/.test(meta.payloadHash||'')))throw Error('Original backup hash binding is missing');
   }catch(error){return Promise.reject(error);}
   return serial(async()=>{
    const changesHash=await sha256(JSON.stringify(captured)),originalHash=meta.originalCode===undefined?null:await sha256(meta.originalCode);
    return transaction(async()=>{
     const before=await snapshot();if(before.revision!==expectedRevision)throw Error('Native progress revision changed. Reload before saving again.');
     if(before.revision===Number.MAX_SAFE_INTEGER)throw Error('Native progress revision needs an upgrade.');
     const revision=before.revision+1,reason=meta.reason||'save';
     if(reason==='erase'){
      await connection.run('DELETE FROM grove_revisions',[],false);await connection.run('DELETE FROM grove_originals',[],false);await connection.run('DELETE FROM grove_outbox',[],false);
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
     await connection.run('UPDATE grove_meta SET revision=? WHERE id=1',[revision],false);
     return snapshot();
    });
   });
  },
  exportRecovery:()=>serial(()=>transaction(async()=>({
   format:'mandarin-grove-native-recovery-v1',snapshot:await snapshot(),
   originals:await Promise.all((await rows('SELECT sha256,code_json,payload_hash,created FROM grove_originals ORDER BY sha256')).map(async row=>({sha256:row.sha256,code:await originalCode(row),payloadHash:row.payload_hash,created:row.created}))),
   revisions:(await rows('SELECT revision,reason,created,changes_hash,before_json FROM grove_revisions ORDER BY revision')).map(row=>({revision:row.revision,reason:row.reason,created:row.created,changesHash:row.changes_hash,before:row.before_json===null?null:JSON.parse(String(row.before_json))}))
  })))
 };
}
