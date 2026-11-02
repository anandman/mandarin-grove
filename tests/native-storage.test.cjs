const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {openDriver}=require('./helpers/sqlite-driver.cjs');
let Native,createDatabase;try{Native=require('../adapters/native-storage.js');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
try{({createDatabase}=require('../mobile/src/database.ts'));}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
const codec={decodeUtf8:code=>new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(code,'base64')),encodeUtf8:text=>Buffer.from(text,'utf8').toString('base64')};
const fixture=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/backups',name),'utf8'));
const code=value=>codec.encodeUtf8(JSON.stringify(value)),digest=value=>crypto.createHash('sha256').update(value).digest('hex');
async function setup({file,migrate,wrap,beforeErase}={}){
 assert.equal(typeof createDatabase,'function','Real SQLite transaction implementation is available');assert.equal(typeof Native?.createRepository,'function','Native repository is available');
 file=file||path.join(fs.mkdtempSync(path.join(os.tmpdir(),'grove-native-repository-')),'grove.sqlite');const driver=openDriver(file);
 const database=await createDatabase(wrap?wrap(driver):driver,{now:()=>123});return {file,driver,database,repository:Native.createRepository({database,codec,migrate,beforeErase,now:()=>123,makeId:()=> 'fixed'})};
}

test('native initialization uses query for Android row-returning PRAGMAs and verifies durable settings',async()=>{
 const a=await setup({wrap:d=>({...d,execute:async(sql,...args)=>{if(/^\s*PRAGMA/i.test(sql))throw Error('Queries can be performed using query methods only');return d.execute(sql,...args);}})});
 assert.equal((await a.driver.query('PRAGMA journal_mode')).values[0].journal_mode,'wal');
 assert.equal((await a.driver.query('PRAGMA synchronous')).values[0].synchronous,2);
 assert.equal((await a.driver.query('PRAGMA busy_timeout')).values[0].timeout,5000);
 await a.driver.close();
});

test('original UTF-8 BOM survives native UTF-16 text binding semantics and repeats without hash mismatch',async()=>{
 const a=await setup({wrap:d=>({...d,run:(sql,values=[],...rest)=>d.run(sql,values.map(value=>typeof value==='string'&&value.startsWith('\ufeff')?value.slice(1):value),...rest)})});
 const original='\ufeff\n'+code(fixture('original-v1.json'))+'\r\n';await a.repository.importBackup(original);await a.repository.importBackup(original);
 const recovery=await a.database.exportRecovery();assert.equal(recovery.originals[0].code,original);assert.equal(recovery.originals[0].sha256,digest(original));await a.driver.close();
});

async function legacyNative(){
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'grove-native-v1-')),'legacy.sqlite'),d=openDriver(file),f=fixture('original-v1.json'),original='\ufeff\n'+code(f)+'\r\n';
 await d.execute(`CREATE TABLE grove_meta(id INTEGER PRIMARY KEY,schema_version INTEGER NOT NULL,revision INTEGER NOT NULL);INSERT INTO grove_meta VALUES(1,1,7);
 CREATE TABLE grove_entries(namespace TEXT NOT NULL,key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE grove_revisions(revision INTEGER PRIMARY KEY,reason TEXT NOT NULL,created INTEGER NOT NULL,changes_hash TEXT NOT NULL,before_json TEXT);
 CREATE TABLE grove_originals(sha256 TEXT PRIMARY KEY,code TEXT NOT NULL,payload_hash TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE grove_outbox(operation_id TEXT PRIMARY KEY,payload TEXT NOT NULL,created INTEGER NOT NULL);`);
 await d.run('INSERT INTO grove_entries VALUES(?,?,?)',['progress','zh_profiles',JSON.stringify(f.PR)]);for(const[id,raw]of Object.entries(f.data))await d.run('INSERT INTO grove_entries VALUES(?,?,?)',['progress','zh_p_'+id,raw]);
 await d.run('INSERT INTO grove_originals VALUES(?,?,?,?)',[digest(original),original.slice(1),digest(JSON.stringify(f)),123]);
 return {file,d,f,original};
}

test('v1 upgrade preserves legacy rows and recovers a missing leading BOM only with its exact existing SHA-256 proof',async()=>{
 const a=await legacyNative(),before=(await a.d.query('SELECT * FROM grove_entries ORDER BY key')).values,legacy=(await a.d.query('SELECT code FROM grove_originals')).values[0].code;
 const database=await createDatabase(a.d);assert.deepEqual((await a.d.query('SELECT * FROM grove_entries ORDER BY key')).values,before);assert.equal((await a.d.query('SELECT code FROM grove_originals')).values[0].code,legacy);
 assert.equal((await a.d.query('SELECT schema_version FROM grove_meta')).values[0].schema_version,3);const recovery=await database.exportRecovery();assert.equal(recovery.originals[0].code,a.original);assert.equal(recovery.snapshot.revision,8);assert.ok(recovery.revisions.some(r=>r.reason==='upgrade'&&r.before.revision===7));
 await createDatabase(a.d);assert.equal((await database.readSnapshot()).revision,8);await a.d.close();
});

test('an unrecognized legacy original hash mismatch refuses upgrade and keeps all original columns',async()=>{
 const a=await legacyNative();await a.d.run('UPDATE grove_originals SET code=?',['unknown damaged original']);
 await assert.rejects(createDatabase(a.d),/original.*hash|original.*recovery/i);assert.equal((await a.d.query('SELECT schema_version FROM grove_meta')).values[0].schema_version,1);assert.equal((await a.d.query('PRAGMA table_info(grove_originals)')).values.some(r=>r.name==='code_json'),false);assert.equal((await a.d.query('SELECT code FROM grove_originals')).values[0].code,'unknown damaged original');await a.d.close();
});

test('failed v1 upgrade rolls back schema, original encoding and recovery receipt together, then retries',async()=>{
 const a=await legacyNative(),before=(await a.d.query('SELECT * FROM grove_originals')).values;
 await assert.rejects(createDatabase({...a.d,run:async(sql,...args)=>{if(sql.includes('SET schema_version=3'))throw Error('Synthetic migration interruption');return a.d.run(sql,...args);}}),/migration interruption/);
 assert.equal((await a.d.query('SELECT schema_version,revision FROM grove_meta')).values[0].schema_version,1);assert.equal((await a.d.query('PRAGMA table_info(grove_originals)')).values.some(r=>r.name==='code_json'),false);assert.deepEqual((await a.d.query('SELECT * FROM grove_originals')).values,before);assert.deepEqual((await a.d.query('SELECT * FROM grove_revisions')).values,[]);
 const database=await createDatabase(a.d);assert.equal((await database.exportRecovery()).originals[0].code,a.original);await a.d.close();
});

test('both frozen backups preserve every raw child, unknown field and envelope through fresh SQLite connections',async()=>{
 for(const name of ['original-v1.json','grove-v1.json']){
  const {file,driver,repository}=await setup(),f=fixture(name);f.futureEnvelope={keep:['绿',null,{opaque:true}]};
  await repository.importBackup(code(f));assert.deepEqual(JSON.parse(codec.decodeUtf8(await repository.exportBackup())),f);await driver.close();
  const reopened=await setup({file});assert.deepEqual(JSON.parse(codec.decodeUtf8(await reopened.repository.exportBackup())),f);await reopened.driver.close();
 }
});

test('preview and malformed inactive child never replace any native value',async()=>{
 const {driver,repository,database}=await setup();await repository.importBackup(code(fixture('original-v1.json')));const before=await database.readSnapshot();
 const good=fixture('grove-v1.json');await repository.previewBackup(code(good));assert.deepEqual(await database.readSnapshot(),before);
 good.data['synthetic-b']='{broken';await assert.rejects(repository.importBackup(code(good)));assert.deepEqual(await database.readSnapshot(),before);await driver.close();
});

test('all inactive migrations pass prevalidation before one native import transaction starts',async()=>{
 const {driver,repository,database}=await setup({migrate:(value,_now,profile)=>{if(profile.id==='synthetic-b')throw Error('Unsupported future evidence');return value;}}),before=await database.readSnapshot();
 await assert.rejects(repository.importBackup(code(fixture('grove-v1.json'))),/Unsupported future evidence/);assert.deepEqual(await database.readSnapshot(),before);await driver.close();
});

test('failure immediately before COMMIT rolls back every imported child and original/recovery rows',async()=>{
 let fail=false;const {driver,database,repository}=await setup({wrap:connection=>({...connection,commitTransaction:async()=>{if(fail){fail=false;throw Error('Synthetic precommit failure');}return connection.commitTransaction();}})});
 await repository.importBackup(code(fixture('original-v1.json')));const before=await database.exportRecovery();fail=true;
 await assert.rejects(repository.importBackup(code(fixture('grove-v1.json'))),/precommit failure/);assert.deepEqual(await database.exportRecovery(),before);
 await repository.importBackup(code(fixture('grove-v1.json')));assert.deepEqual(JSON.parse(codec.decodeUtf8(await repository.exportBackup())),fixture('grove-v1.json'));await driver.close();
});

test('native string rejections become retryable Error objects without advancing read baselines',async()=>{
 let fail=false;const a=await setup({wrap:d=>({...d,commitTransaction:async()=>{if(fail){fail=false;throw 'Synthetic native commit refusal';}return d.commitTransaction();}})});
 await a.repository.importBackup(code(fixture('original-v1.json')));const registry=await a.repository.readRegistry(),profile=await a.repository.readProfile(registry.cur),before=await a.database.readSnapshot();profile.stars++;
 fail=true;await assert.rejects(a.repository.saveProfile(registry.cur,profile),error=>error instanceof Error&&/native commit refusal/.test(error.message));assert.deepEqual(await a.database.readSnapshot(),before);
 await a.repository.saveProfile(registry.cur,profile);assert.equal((await a.repository.peekProfile(registry.cur)).stars,profile.stars);await a.driver.close();
});

test('a lost commit acknowledgement retries the same candidate without duplicating earned progress',async()=>{
 let fail=false;const a=await setup({wrap:d=>({...d,commitTransaction:async()=>{const result=await d.commitTransaction();if(fail){fail=false;throw Error('Synthetic lost acknowledgement');}return result;}})});
 await a.repository.importBackup(code(fixture('original-v1.json')));const registry=await a.repository.readRegistry(),profile=await a.repository.readProfile(registry.cur);profile.stars++;
 fail=true;await assert.rejects(a.repository.saveProfile(registry.cur,profile),/lost acknowledgement/);await a.repository.saveProfile(registry.cur,profile);
 assert.equal((await a.repository.peekProfile(registry.cur)).stars,profile.stars);await a.driver.close();
});

test('Android auto-rollback can reject endTransaction after releasing the transaction; retain original failure and retry',async()=>{
 let fail=false;const a=await setup({wrap:d=>({...d,run:async(...args)=>{if(fail){fail=false;throw Error('Synthetic database or disk is full');}return d.run(...args);},rollbackTransaction:async()=>{await d.rollbackTransaction();throw Error('cannot rollback - no transaction is active');}})});
 await a.repository.importBackup(code(fixture('original-v1.json')));const r=await a.repository.readRegistry(),p=await a.repository.readProfile(r.cur),before=await a.database.readSnapshot();p.stars++;
 fail=true;await assert.rejects(a.repository.saveProfile(r.cur,p),/disk is full/);assert.deepEqual(await a.database.readSnapshot(),before);
 await a.repository.saveProfile(r.cur,p);assert.equal((await a.repository.peekProfile(r.cur)).stars,p.stars);await a.driver.close();
});

test('an unconfirmed rollback blocks partial reads and all later writes until a fresh connection',async()=>{
 let fail=false,writes=0;const a=await setup({wrap:d=>({...d,run:async(...args)=>{if(fail&&++writes===2)throw Error('Synthetic disk full after one real write');return d.run(...args);},rollbackTransaction:async()=>{throw Error('Synthetic lost driver');}})});
 await a.repository.importBackup(code(fixture('original-v1.json')));const before=await a.database.readSnapshot(),r=await a.repository.readRegistry(),p=await a.repository.readProfile(r.cur);p.stars++;fail=true;
 await assert.rejects(a.database.commit(before.revision,[['zh_p_'+r.cur,JSON.stringify(p)],['zh_profiles',before.registry]]),/needs recovery/);
 assert.equal(a.driver.sqlite.isTransaction,true,'The failed native rollback leaves real uncommitted data on this handle');
 await assert.rejects(a.database.readSnapshot(),/needs recovery/);
 await assert.rejects(a.repository.peekProfile(r.cur),/needs recovery/);
 await assert.rejects(a.database.commit(before.revision,[]),/needs recovery/);
 await assert.rejects(a.database.exportRecovery(),/needs recovery/);
 await a.driver.close();const reopened=await setup({file:a.file});assert.deepEqual(await reopened.database.readSnapshot(),before);await reopened.driver.close();
});

test('iOS auto-abort leaves a stale plugin flag; an empty rollback handshake confirms recovery without writes',async()=>{
 let fail=false,stale=false;const a=await setup({wrap:d=>({...d,
  run:async(...args)=>{if(fail){fail=false;await d.rollbackTransaction();stale=true;throw Error('Synthetic database or disk is full');}return d.run(...args);},
  isTransactionActive:async()=>({result:stale||d.sqlite.isTransaction}),
  beginTransaction:async()=>{const result=await d.beginTransaction();stale=true;return result;},
  rollbackTransaction:async()=>{const result=await d.rollbackTransaction();stale=false;return result;},
  commitTransaction:async()=>{const result=await d.commitTransaction();stale=false;return result;}
 })});
 await a.repository.importBackup(code(fixture('original-v1.json')));const r=await a.repository.readRegistry(),p=await a.repository.readProfile(r.cur),before=await a.database.readSnapshot();p.stars++;fail=true;
 await assert.rejects(a.repository.saveProfile(r.cur,p),/disk is full/);assert.deepEqual(await a.database.readSnapshot(),before);assert.equal(stale,false);
 await a.repository.saveProfile(r.cur,p);assert.equal((await a.repository.peekProfile(r.cur)).stars,p.stars);await a.driver.close();
});

for(const stage of ['before','after'])test('host-process kill '+stage+' COMMIT preserves an all-or-none real SQLite import',async()=>{
 const {fork}=require('node:child_process'),a=await setup();await a.repository.importBackup(code(fixture('original-v1.json')));await a.driver.close();
 const child=fork(path.join(__dirname,'helpers/native-commit-child.cjs'),[],{stdio:['ignore','ignore','ignore','ipc']});
 const observed=new Promise((resolve,reject)=>{child.once('message',message=>message.error?reject(Error(message.error)):resolve(message));child.once('error',reject);child.once('exit',(_code,signal)=>{if(signal!=='SIGKILL')reject(Error('Child exited before pause'));});});
 child.send({file:a.file,code:code(fixture('grove-v1.json')),stage});assert.equal((await observed).stage,stage);
 const exited=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));child.kill('SIGKILL');assert.equal((await exited).signal,'SIGKILL');
 const reopened=await setup({file:a.file});assert.deepEqual(JSON.parse(codec.decodeUtf8(await reopened.repository.exportBackup())),fixture(stage==='before'?'original-v1.json':'grove-v1.json'));await reopened.driver.close();
});

test('actual SQLITE_FULL rejects an oversized write while retaining the entire acknowledged snapshot',async()=>{
 const {driver,database,repository}=await setup();await repository.importBackup(code(fixture('original-v1.json')));const registry=await repository.readRegistry(),profile=await repository.readProfile(registry.cur),before=await database.readSnapshot();
 const {values}=await driver.query('PRAGMA page_count');await driver.execute('PRAGMA max_page_count='+values[0].page_count);profile.largeFutureField='保'.repeat(1000000);
 await assert.rejects(repository.saveProfile(registry.cur,profile),/full/i);assert.deepEqual(await database.readSnapshot(),before);await driver.close();
});

test('two conditional commits cannot both consume the same local database revision',async()=>{
 const {driver,database}=await setup(),before=await database.readSnapshot();
 const results=await Promise.allSettled([database.commit(before.revision,[['zh_probe','one']]),database.commit(before.revision,[['zh_probe','two']])]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/changed|revision/i);
 const after=await database.readSnapshot();assert.equal(after.entries.zh_probe,'one');assert.equal(after.revision,before.revision+1);await driver.close();
});

test('fresh snapshot checks reject a second-actor conflicting edit and preserve disjoint unknown fields',async()=>{
 const a=await setup();await a.repository.importBackup(code(fixture('original-v1.json')));const b=await setup({file:a.file});
 const registry=await a.repository.readRegistry();await b.repository.readRegistry();const x=await a.repository.readProfile(registry.cur),y=await b.repository.readProfile(registry.cur);
 x.stars=160;await a.repository.saveProfile(registry.cur,x);y.stars=170;const before=await b.database.readSnapshot();await assert.rejects(b.repository.saveProfile(registry.cur,y),/changed|conflict/i);assert.deepEqual(await b.database.readSnapshot(),before);
 const latest=await b.repository.readProfile(registry.cur);latest.nativeUnknown={keep:true};await b.repository.saveProfile(registry.cur,latest);x.cfg.test='2027-01-01';await a.repository.saveProfile(registry.cur,x);
 assert.deepEqual((await a.repository.peekProfile(registry.cur)).nativeUnknown,{keep:true});await a.driver.close();await b.driver.close();
});

test('metadata and matching grade configuration commit together; failed settings retain retry baselines',async()=>{
 let fail=false;const a=await setup({wrap:d=>({...d,run:async(sql,values,...rest)=>{if(fail&&values.includes('zh_profiles')){fail=false;throw Error('Synthetic registry write failure');}return d.run(sql,values,...rest);}})});
 await a.repository.importBackup(code(fixture('original-v1.json')));const registry=await a.repository.readRegistry(),profile=await a.repository.readProfile(registry.cur),before=await a.database.readSnapshot();
 registry.list[0].gr='4';profile.cfg.quiz='祖正';fail=true;await assert.rejects(a.repository.saveChildSettings(registry.cur,registry,profile),/registry write failure/);assert.deepEqual(await a.database.readSnapshot(),before);
 const result=await a.repository.saveChildSettings(registry.cur,registry,profile);assert.equal(result.registry.list[0].gr,'4');assert.equal(result.profile.cfg.quiz,'祖正');await a.driver.close();
});

test('native preference/report namespaces do not enter learner backups or invalidate an in-progress profile edit',async()=>{
 const a=await setup();await a.repository.importBackup(code(fixture('grove-v1.json')));const registry=await a.repository.readRegistry(),profile=await a.repository.readProfile(registry.cur),backup=await a.repository.exportBackup();
 await a.repository.writePreference('zh_voice','voice:synthetic');await a.repository.writePreference('zh_appearance','dark');await a.repository.saveReport({id:'local',delivery:{state:'pending'},future:['保留']});
 assert.equal(await a.repository.exportBackup(),backup);profile.stars++;await a.repository.saveProfile(registry.cur,profile);assert.equal((await a.repository.readReports())[0].future[0],'保留');
 const snapshot=await a.database.readSnapshot();assert.equal(snapshot.entries.zh_voice,'voice:synthetic');assert.ok(snapshot.entries.zh_feedback_v1);await a.driver.close();
});

test('repeated import neither double-credits rewards nor loses exact original-code/payload hash binding',async()=>{
 const a=await setup(),f=fixture('grove-v1.json'),encoded='\n'+code(f)+'\n';await a.repository.importBackup(encoded);await a.repository.importBackup(encoded);
 assert.deepEqual(JSON.parse(codec.decodeUtf8(await a.repository.exportBackup())),f);
 const recovery=await a.database.exportRecovery();assert.equal(recovery.originals.length,1);assert.equal(recovery.originals[0].code,encoded);assert.equal(recovery.originals[0].sha256,digest(encoded));assert.equal(recovery.originals[0].payloadHash,digest(JSON.stringify(f)));
 assert.ok(recovery.revisions.some(r=>r.reason==='import'&&r.before));await a.driver.close();
});

test('a stale comparison and explicit stale revision cannot replace current native progress',async()=>{
 const a=await setup();await a.repository.importBackup(code(fixture('original-v1.json')));const view=await a.repository.backupSummary(),snapshot=await a.database.readSnapshot();
 const registry=await a.repository.readRegistry(),profile=await a.repository.readProfile(registry.cur);profile.stars++;await a.repository.saveProfile(registry.cur,profile);const before=await a.database.readSnapshot();
 await assert.rejects(a.repository.importBackup(code(fixture('grove-v1.json')),{expectedStamp:view.stamp}),/changed/i);
 await assert.rejects(a.repository.saveProfile(registry.cur,profile,{expectedRevision:snapshot.revision}),/changed|revision/i);assert.deepEqual(await a.database.readSnapshot(),before);await a.driver.close();
});

test('unknown future schema is refused without modifying its database bytes',async()=>{
 assert.equal(typeof createDatabase,'function');const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'grove-future-db-')),'future.sqlite'),driver=openDriver(file);
 await driver.execute("CREATE TABLE grove_meta(id INTEGER PRIMARY KEY,schema_version INTEGER NOT NULL,revision INTEGER NOT NULL);INSERT INTO grove_meta VALUES(1,99,7);CREATE TABLE future_secret_learner(value TEXT);INSERT INTO future_secret_learner VALUES('preserve unknown original');");
 const before=fs.readFileSync(file);await assert.rejects(createDatabase(driver),/newer|unsupported|schema/i);assert.deepEqual(fs.readFileSync(file),before);await driver.close();
});

test('native bootstrap can inspect supported and future schemas through an actual read-only connection',async()=>{
 const {inspectSchema}=require('../mobile/src/database.ts');assert.equal(typeof inspectSchema,'function','A read-only preflight precedes native read-write opening');
 const a=await setup();await a.driver.close();const readOnly=openDriver(a.file,{readOnly:true});assert.equal((await inspectSchema(readOnly)).version,3);await readOnly.close();
 const write=openDriver(a.file);await write.run('UPDATE grove_meta SET schema_version=99 WHERE id=1');await write.close();const before=fs.readFileSync(a.file),future=openDriver(a.file,{readOnly:true});await assert.rejects(inspectSchema(future),/newer|unsupported/);await future.close();assert.deepEqual(fs.readFileSync(a.file),before);
});

async function privateEraseFixture(options={}){
 const a=await setup(options),retired='synthetic-retired-page-'+crypto.randomUUID(),current='synthetic-current-private-'+crypto.randomUUID();
 await a.driver.query('PRAGMA secure_delete=OFF');await a.driver.query('PRAGMA wal_autocheckpoint=0');
 await a.driver.run('INSERT INTO grove_entries(namespace,key,value) VALUES(?,?,?)',['progress','zh_retired',retired.repeat(500)]);await a.driver.run('DELETE FROM grove_entries WHERE key=?',['zh_retired']);await a.driver.query('PRAGMA wal_checkpoint(TRUNCATE)');
 assert.ok(fs.readFileSync(a.file).includes(Buffer.from(retired)),'Retired data really exists in the old free pages before the explicit erase');
 const f=fixture('original-v1.json');f.PR.list[0].name=current;const original=code(f);await a.repository.importBackup(original);await a.repository.writePreference('zh_voice',current);await a.repository.saveReport({id:'synthetic-private-report',note:current});
 await a.driver.run('INSERT INTO grove_outbox(operation_id,payload,created) VALUES(?,?,?)',['synthetic-op',current,123]);
 const external=a.file+'.selected-backup.txt';fs.writeFileSync(external,original);return {...a,retired,current,original,external};
}
function erasedFiles(a){
 for(const suffix of ['', '-wal'])if(fs.existsSync(a.file+suffix)){
  const bytes=fs.readFileSync(a.file+suffix);for(const marker of [a.retired,a.current,a.original])assert.equal(bytes.includes(Buffer.from(marker)),false,'No private source remains in DB'+suffix);
 }
 assert.equal(fs.readFileSync(a.external,'utf8'),a.original,'User-selected backup is untouched');
}
test('explicit native erase clears old free pages, originals, reports and WAL before acknowledgement',async()=>{
 const a=await privateEraseFixture();assert.equal(await a.repository.eraseLocal(),true);assert.deepEqual((await a.database.readSnapshot()).entries,{});
 for(const table of ['grove_entries','grove_originals','grove_outbox'])assert.equal((await a.driver.query('SELECT count(*) AS n FROM '+table)).values[0].n,0);
 assert.deepEqual((await a.database.exportRecovery()).revisions.map(r=>[r.reason,r.before]),[['erase',null]]);erasedFiles(a);await a.driver.close();
});
test('erase cleanup failure is not acknowledged and a fresh bootstrap finishes it before exposing a repository',async()=>{
 let fail=false;const a=await privateEraseFixture({wrap:d=>({...d,execute:async(sql,...rest)=>{if(fail&&sql==='VACUUM'){fail=false;throw Error('Synthetic erase disk full');}return d.execute(sql,...rest);}})});fail=true;
 await assert.rejects(a.repository.eraseLocal(),/erasure.*incomplete|erase.*incomplete/i);await assert.rejects(a.database.readSnapshot(),/erasure.*incomplete|erase.*incomplete/i);
 const reopened=await setup({file:a.file});assert.deepEqual((await reopened.database.readSnapshot()).entries,{});erasedFiles(a);await reopened.driver.close();await a.driver.close();
});
test('a real reader blocking WAL truncation prevents erase acknowledgement until restart can finish',async()=>{
 const a=await privateEraseFixture(),reader=openDriver(a.file);await reader.execute('BEGIN');await reader.query('SELECT * FROM grove_entries');await a.driver.query('PRAGMA busy_timeout=10');
 try{await assert.rejects(a.repository.eraseLocal(),/erasure.*incomplete|erase.*incomplete/i);await assert.rejects(a.database.readSnapshot(),/erasure.*incomplete|erase.*incomplete/i);}finally{await reader.execute('ROLLBACK');await reader.close();}
 const reopened=await setup({file:a.file});assert.deepEqual((await reopened.database.readSnapshot()).entries,{});erasedFiles(a);await reopened.driver.close();await a.driver.close();
});
test('an OS kill after erase COMMIT resumes page and WAL cleanup before fresh repository readiness',async()=>{
 const {fork}=require('node:child_process'),a=await privateEraseFixture();await a.driver.close();
 const child=fork(path.join(__dirname,'helpers/native-commit-child.cjs'),[],{stdio:['ignore','ignore','ignore','ipc']});
 const exited=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
 try{
  const observed=new Promise((resolve,reject)=>{child.once('message',m=>m.error?reject(Error(m.error)):resolve(m));child.once('error',reject);});
  child.send({file:a.file,code:a.original,stage:'erase'});assert.equal((await observed).stage,'erase');
  assert.ok(['','-wal'].some(suffix=>fs.existsSync(a.file+suffix)&&fs.readFileSync(a.file+suffix).includes(Buffer.from(a.retired))),'Killed database history really contains retired private bytes before cleanup');
 }finally{child.kill('SIGKILL');await exited;}
 const reopened=await setup({file:a.file});assert.deepEqual((await reopened.database.readSnapshot()).entries,{});erasedFiles(a);await reopened.driver.close();
});
test('another existing connection cannot read or write while physical erasure is pending',async()=>{
 let armed=false,reached,release;const arrived=new Promise(r=>reached=r),gate=new Promise(r=>release=r);
 const a=await privateEraseFixture({wrap:d=>({...d,execute:async(sql,...args)=>{if(armed&&sql==='VACUUM'){reached();await gate;throw Error('Synthetic interrupted erasure');}return d.execute(sql,...args);}})}),b=await setup({file:a.file});armed=true;
 const erasing=a.repository.eraseLocal();const failed=assert.rejects(erasing,/erasure.*incomplete/i);
 try{await arrived;await assert.rejects(b.database.readSnapshot(),/erasure/i);await assert.rejects(b.repository.writePreference('zh_voice','synthetic-new-setting'),/erasure/i);}finally{release();await failed;await b.driver.close();}
 const reopened=await setup({file:a.file});assert.deepEqual((await reopened.database.readSnapshot()).entries,{});erasedFiles(a);await reopened.driver.close();await a.driver.close();
});
test('a lost erase COMMIT acknowledgement cannot expose erased state or mask cleanup with another save',async()=>{
 let armed=false;const a=await privateEraseFixture({wrap:d=>({...d,commitTransaction:async()=>{const result=await d.commitTransaction();if(armed){armed=false;throw Error('Synthetic lost erase acknowledgement');}return result;}})});armed=true;
 await assert.rejects(a.repository.eraseLocal(),/lost erase acknowledgement/);await assert.rejects(a.database.readSnapshot(),/erasure/i);await assert.rejects(a.repository.writePreference('zh_voice','synthetic-new-setting'),/erasure/i);
 const reopened=await setup({file:a.file});assert.deepEqual((await reopened.database.readSnapshot()).entries,{});erasedFiles(a);await reopened.driver.close();await a.driver.close();
});
async function legacySchemaTwo(){
 const a=await legacyNative();await a.d.execute('ALTER TABLE grove_originals ADD COLUMN code_json TEXT;');await a.d.run('UPDATE grove_originals SET code_json=?',[JSON.stringify(a.original)]);await a.d.run('UPDATE grove_meta SET schema_version=2 WHERE id=1');return a;
}
test('schema2 upgrades atomically to private-erasure metadata without changing original or profile bytes',async()=>{
 const a=await legacySchemaTwo(),originals=(await a.d.query('SELECT * FROM grove_originals')).values,entries=(await a.d.query('SELECT * FROM grove_entries ORDER BY key')).values;
 const database=await createDatabase(a.d);assert.deepEqual((await a.d.query('SELECT * FROM grove_originals')).values,originals);assert.deepEqual((await a.d.query('SELECT * FROM grove_entries ORDER BY key')).values,entries);assert.equal((await a.d.query('SELECT erase_pending FROM grove_meta')).values[0].erase_pending,0);assert.equal((await database.exportRecovery()).originals[0].code,a.original);await a.d.close();
});
test('interrupted schema2 metadata upgrade retains the old schema and all original bytes, then retries',async()=>{
 const a=await legacySchemaTwo(),originals=(await a.d.query('SELECT * FROM grove_originals')).values;
 await assert.rejects(createDatabase({...a.d,run:async(sql,...args)=>{if(sql.includes('SET schema_version=3'))throw Error('Synthetic erase-metadata migration failure');return a.d.run(sql,...args);}}),/migration failure/);
 assert.equal((await a.d.query('SELECT schema_version FROM grove_meta')).values[0].schema_version,2);assert.equal((await a.d.query('PRAGMA table_info(grove_meta)')).values.some(r=>r.name==='erase_pending'),false);assert.deepEqual((await a.d.query('SELECT * FROM grove_originals')).values,originals);await createDatabase(a.d);await a.d.close();
});
test('legacy schema2 erase receipt resumes private cleanup during the metadata upgrade',async()=>{
 const a=await legacySchemaTwo(),marker='synthetic-legacy-erased-private-'+crypto.randomUUID();await a.d.query('PRAGMA secure_delete=OFF');
 await a.d.run('INSERT INTO grove_entries(namespace,key,value) VALUES(?,?,?)',['progress','zh_retired',marker.repeat(500)]);
 for(const table of ['grove_entries','grove_originals','grove_revisions','grove_outbox'])await a.d.run('DELETE FROM '+table);
 await a.d.run('INSERT INTO grove_revisions(revision,reason,created,changes_hash,before_json) VALUES(?,?,?,?,?)',[7,'erase',123,digest('legacy erase'),null]);
 assert.ok(fs.readFileSync(a.file).includes(Buffer.from(marker)));
 const database=await createDatabase(a.d);assert.deepEqual((await database.readSnapshot()).entries,{});assert.equal((await a.d.query('SELECT erase_pending FROM grove_meta')).values[0].erase_pending,0);
 for(const suffix of ['','-wal'])if(fs.existsSync(a.file+suffix))assert.equal(fs.readFileSync(a.file+suffix).includes(Buffer.from(marker)),false);await a.d.close();
});
test('native erase waits for private file cleanup and keeps SQL data unchanged until it succeeds',async()=>{
 let calls=0,release;const gate=new Promise(r=>release=r),a=await setup({beforeErase:async()=>{calls++;await gate;}});await a.repository.importBackup(code(fixture('original-v1.json')));const before=await a.database.exportRecovery();const erasing=a.repository.eraseLocal();
 try{await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.deepEqual(await a.database.exportRecovery(),before);}finally{release();await erasing;}
 assert.deepEqual((await a.database.readSnapshot()).entries,{});await a.driver.close();
});
test('failed private file cleanup refuses native erase without changing any progress or original',async()=>{
 const a=await setup({beforeErase:async()=>{throw Error('Synthetic temporary file cleanup refused');}});await a.repository.importBackup(code(fixture('original-v1.json')));const before=await a.database.exportRecovery();await assert.rejects(a.repository.eraseLocal(),/temporary file cleanup refused/);assert.deepEqual(await a.database.exportRecovery(),before);await a.driver.close();
});
