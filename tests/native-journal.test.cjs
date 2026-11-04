const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {openDriver}=require('./helpers/sqlite-driver.cjs');
const {createDatabase}=require('../mobile/src/database.ts');
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),actor=uid(1),installation=uid(2),profile=uid(3),ns='synthetic-account-a';
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
function operation(n,{counter=n,deviceId=actor,parents=[],...rest}={}){return JSON.stringify({schema:1,id:uid(100+n),deviceId,counter,parents,profileUuid:profile,kind:'answerRecorded',at:100,policyVersion:1,payload:{synthetic:true,...rest}});}
async function setup({file,wrap}={}){file||=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'grove-journal-')),'progress.sqlite');const driver=openDriver(file),database=await createDatabase(wrap?wrap(driver):driver,{now:()=>123});return {file,driver,database};}
async function activate(a,options={}){assert.equal(typeof a.database.activateJournal,'function','Native SQLite owns durable scoped journal context');return a.database.activateJournal({namespace:ns,installationId:installation,actorId:actor,enabled:true,...options});}
const local=(raw,{counter=0,batchId=uid(50),namespace=ns,actorId=actor,installationId=installation}={})=>({journal:{namespace,actorId,installationId,expectedCounter:counter,batchId,records:Array.isArray(raw)?raw:[raw]}});
const changes=n=>[['zh_p_synthetic',JSON.stringify({stars:n,future:{keep:true}})]];

test('a local practice change, immutable operation, counter and upload intent commit together',async()=>{
 const a=await setup();try{await activate(a);const raw=operation(1);const saved=await a.database.commit(0,changes(1),local(raw));assert.equal(saved.profiles.synthetic,changes(1)[0][1]);const j=await a.database.readJournal(ns);assert.equal(j.state.counter,1);assert.equal(j.records.length,1);assert.equal(j.records[0].raw,raw);assert.equal(j.records[0].sha256,digest(raw));assert.equal(j.outbox.length,1);assert.equal(j.outbox[0].id,uid(101));}finally{await a.driver.close();}
});
test('a real SQLite rejection rolls back learner entry, counter, operation and outbox',async()=>{
 const a=await setup();try{await activate(a);await a.driver.execute("CREATE TRIGGER fail_journal BEFORE INSERT ON grove_outbox BEGIN SELECT RAISE(ABORT,'synthetic outbox failure'); END;",false);await assert.rejects(a.database.commit(0,changes(1),local(operation(1))));assert.equal((await a.database.readSnapshot()).revision,0);const j=await a.database.readJournal(ns);assert.equal(j.state.counter,0);assert.equal(j.records.length,0);assert.equal(j.outbox.length,0);}finally{await a.driver.close();}
});
test('a lost real COMMIT acknowledgement reopens and retries the identical batch exactly once',async()=>{
 let lose=false;const a=await setup({wrap:d=>({...d,async commitTransaction(){const result=await d.commitTransaction();if(lose){lose=false;throw Error('synthetic lost COMMIT acknowledgement');}return result;}})});await activate(a);const raw=operation(1),meta=local(raw);lose=true;await assert.rejects(a.database.commit(0,changes(1),meta));await a.driver.close();const b=await setup({file:a.file});try{const saved=await b.database.commit(0,changes(1),meta);assert.equal(saved.revision,1);assert.equal(saved.profiles.synthetic,changes(1)[0][1]);const j=await b.database.readJournal(ns);assert.equal(j.state.counter,1);assert.equal(j.records.length,1);assert.equal(j.outbox.length,1);await assert.rejects(b.database.commit(0,changes(99),meta));assert.equal((await b.database.readSnapshot()).profiles.synthetic,changes(1)[0][1]);}finally{await b.driver.close();}
});
test('nested caller input is frozen at invocation before the native transaction queue runs',async()=>{
 const a=await setup();try{await activate(a);const raw=operation(1),meta=local(raw),promise=a.database.commit(0,changes(1),meta);meta.journal.records[0]=operation(2);meta.journal.actorId=uid(9);await promise;const j=await a.database.readJournal(ns);assert.equal(j.records[0].raw,raw);assert.equal(j.state.counter,1);}finally{await a.driver.close();}
});
test('delivery ACK checks the exact ID/hash and never changes learner revision',async()=>{
 const a=await setup();try{const context=await activate(a),raw=operation(1);await a.database.commit(0,changes(1),local(raw));await assert.rejects(a.database.acknowledgeJournal({context,receipts:[{id:uid(101),sha256:'0'.repeat(64)}]}));assert.equal((await a.database.readJournal(ns)).outbox.length,1);await a.database.acknowledgeJournal({context,receipts:[{id:uid(101),sha256:digest(raw)}]});const j=await a.database.readJournal(ns);assert.equal(j.outbox.length,0);assert.equal(j.records[0].acknowledged,true);assert.equal(j.records[0].raw,raw);assert.equal((await a.database.readSnapshot()).revision,1);}finally{await a.driver.close();}
});
test('old account callbacks cannot acknowledge a new context or discard its own pending progress',async()=>{
 const a=await setup();try{const old=await activate(a),raw=operation(1);await a.database.commit(0,changes(1),local(raw));const other=await activate(a,{namespace:'synthetic-account-b',actorId:uid(9)});await assert.rejects(a.database.acknowledgeJournal({context:old,receipts:[{id:uid(101),sha256:digest(raw)}]}));await assert.rejects(a.database.acknowledgeJournal({context:other,receipts:[{id:uid(101),sha256:digest(raw)}]}));assert.equal((await a.database.readJournal(ns)).outbox.length,1);assert.equal((await a.database.readJournal('synthetic-account-b')).records.length,0);}finally{await a.driver.close();}
});
test('staged receive bytes survive before projection while applied cursor waits for the same transaction',async()=>{
 const a=await setup();try{const context=await activate(a),raw=operation(1,{deviceId:uid(8)});await a.database.stageJournal({context,records:[{raw,sha256:digest(raw)}],cursor:{token:'next',future:{keep:true}}});let j=await a.database.readJournal(ns);assert.equal(j.state.cursor,null);assert.deepEqual(j.state.pendingCursor,{token:'next',future:{keep:true}});assert.equal((await a.database.readSnapshot()).revision,0);await a.database.applyJournal({context,expectedRevision:0,expectedJournalRevision:j.state.revision,changes:changes(7)});j=await a.database.readJournal(ns);assert.deepEqual(j.state.cursor,{token:'next',future:{keep:true}});assert.equal(j.state.pendingCursor,null);assert.equal((await a.database.readSnapshot()).profiles.synthetic,changes(7)[0][1]);}finally{await a.driver.close();}
});
test('future and divergent operation bytes remain recoverable and cannot advance an applied cursor',async()=>{
 const a=await setup();try{const context=await activate(a),raw=operation(1),future=JSON.stringify({...JSON.parse(operation(2)),schema:99,future:{original:true}}),conflict=JSON.stringify({...JSON.parse(raw),payload:{other:true}});await a.database.stageJournal({context,records:[{raw},{raw:future},{raw:conflict}],cursor:'candidate'});const j=await a.database.readJournal(ns);assert.equal(j.records.length,3);assert.ok(j.records.some(r=>r.raw===future));await assert.rejects(a.database.applyJournal({context,expectedRevision:0,expectedJournalRevision:j.state.revision,changes:changes(9)}));assert.equal((await a.database.readSnapshot()).revision,0);assert.equal((await a.database.readJournal(ns)).state.cursor,null);const recovery=await a.database.exportRecovery();assert.ok(JSON.stringify(recovery).includes('original'));}finally{await a.driver.close();}
});
test('raw UTF8 BOM operation bodies survive native text binding and retain their exact hash',async()=>{
 const a=await setup({wrap:d=>({...d,run:(sql,values=[],...rest)=>d.run(sql,values.map(v=>typeof v==='string'&&v.startsWith('\ufeff')?v.slice(1):v),...rest)})});try{const context=await activate(a),raw='\ufeff'+operation(1)+'\r\n';await a.database.stageJournal({context,records:[{raw,sha256:digest(raw)}],cursor:'\ufeffcursor'});const j=await a.database.readJournal(ns);assert.equal(j.records[0].raw,raw);assert.equal(j.records[0].sha256,digest(raw));assert.equal(j.state.pendingCursor,'\ufeffcursor');}finally{await a.driver.close();}
});
test('new installation actor starts fresh while original operations, counter history and pending work survive',async()=>{
 const a=await setup();try{await activate(a);const raw=operation(1);await a.database.commit(0,changes(1),local(raw));await activate(a,{installationId:uid(20),actorId:uid(21)});const j=await a.database.readJournal(ns);assert.equal(j.state.actorId,uid(21));assert.equal(j.state.counter,0);assert.ok(j.state.history.some(row=>row.actor_id===actor&&row.counter===1));assert.equal(j.records[0].raw,raw);assert.equal(j.outbox.length,1);}finally{await a.driver.close();}
});
test('inactive-account practice stays durable locally without uploading it into the newly selected account',async()=>{
 const a=await setup();try{await activate(a);await activate(a,{namespace:'synthetic-account-b',actorId:uid(9)});await a.database.commit(0,changes(1),local(operation(1)));assert.equal((await a.database.readJournal(ns)).outbox.length,1);assert.equal((await a.database.readJournal('synthetic-account-b')).outbox.length,0);assert.equal((await a.database.readSnapshot()).profiles.synthetic,changes(1)[0][1]);}finally{await a.driver.close();}
});
test('remote projection cannot overwrite device preferences or reports',async()=>{
 const a=await setup();try{const context=await activate(a);const j=await a.database.readJournal(ns);for(const key of ['zh_voice','zh_appearance','zh_feedback_v1'])await assert.rejects(a.database.applyJournal({context,expectedRevision:0,expectedJournalRevision:j.state.revision,changes:[[key,'private']]}));assert.equal((await a.database.readSnapshot()).revision,0);}finally{await a.driver.close();}
});
test('explicit private erasure clears every sync row and invalidates old callbacks as well as learner data',async()=>{
 const a=await setup();try{const context=await activate(a),raw=operation(1,{note:'SYNTHETIC_JOURNAL_PRIVATE_MARKER'});await a.database.commit(0,changes(1),local(raw));await a.database.commit(1,[['zh_p_synthetic',null]],{reason:'erase'});await assert.rejects(a.database.acknowledgeJournal({context,receipts:[{id:uid(101),sha256:digest(raw)}]}));const recovery=await a.database.exportRecovery();assert.equal(JSON.stringify(recovery).includes('SYNTHETIC_JOURNAL_PRIVATE_MARKER'),false);const scan=Buffer.concat([fs.readFileSync(a.file),...(fs.existsSync(a.file+'-wal')?[fs.readFileSync(a.file+'-wal')]:[])]);assert.equal(scan.includes(Buffer.from('SYNTHETIC_JOURNAL_PRIVATE_MARKER')),false);}finally{await a.driver.close();}
});

test('receiving the exact uploaded local bytes is one record and still permits exact delivery ACK',async()=>{
 const a=await setup();try{const context=await activate(a),raw=operation(1);await a.database.commit(0,changes(1),local(raw));await a.database.stageJournal({context,records:[{raw,sha256:digest(raw)}],cursor:'first'});await a.database.acknowledgeJournal({context,receipts:[{id:uid(101),sha256:digest(raw)}]});assert.equal((await a.database.readJournal(ns)).records.length,1);}finally{await a.driver.close();}
});
test('applying an ACK-only revision keeps the last applied receive cursor',async()=>{
 const a=await setup();try{const context=await activate(a),raw=operation(1);await a.database.stageJournal({context,records:[{raw}],cursor:'first'});let j=await a.database.readJournal(ns);await a.database.applyJournal({context,expectedRevision:0,expectedJournalRevision:j.state.revision,changes:changes(1)});j=await a.database.readJournal(ns);await a.database.applyJournal({context,expectedRevision:1,expectedJournalRevision:j.state.revision,changes:[]});assert.equal((await a.database.readJournal(ns)).state.cursor,'first');}finally{await a.driver.close();}
});
async function schemaThree({pending=false}={}){
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'grove-journal-v3-')),'legacy.sqlite'),driver=openDriver(file);
 await driver.execute(`CREATE TABLE grove_meta(id INTEGER PRIMARY KEY,schema_version INTEGER NOT NULL,revision INTEGER NOT NULL,erase_pending INTEGER NOT NULL,future_meta TEXT);INSERT INTO grove_meta VALUES(1,3,7,${pending?1:0},'unknown metadata');
 CREATE TABLE grove_entries(namespace TEXT NOT NULL,key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE grove_revisions(revision INTEGER PRIMARY KEY,reason TEXT NOT NULL,created INTEGER NOT NULL,changes_hash TEXT NOT NULL,before_json TEXT);
 CREATE TABLE grove_originals(sha256 TEXT PRIMARY KEY,code TEXT NOT NULL,payload_hash TEXT NOT NULL,created INTEGER NOT NULL,code_json TEXT NOT NULL);
 CREATE TABLE grove_outbox(operation_id TEXT PRIMARY KEY,payload TEXT NOT NULL,created INTEGER NOT NULL,future_column TEXT);`);
 if(!pending){await driver.run('INSERT INTO grove_entries VALUES(?,?,?)',['progress',changes(4)[0][0],changes(4)[0][1]]);await driver.run('INSERT INTO grove_outbox VALUES(?,?,?,?)',['legacy-unknown','unbound private raw',1,'preserve unknown']);}
 return {file,driver};
}
test('schema3 migration preserves learner bytes, unknown columns and every unbound legacy outbox row',async()=>{
 const a=await schemaThree();try{const database=await createDatabase(a.driver),snapshot=await database.readSnapshot();assert.equal(snapshot.profiles.synthetic,changes(4)[0][1]);assert.equal(snapshot.revision,8);assert.equal((await a.driver.query('SELECT future_meta FROM grove_meta')).values[0].future_meta,'unknown metadata');const legacy=(await a.driver.query('SELECT * FROM grove_outbox')).values[0];assert.equal(legacy.future_column,'preserve unknown');assert.equal(legacy.payload,'unbound private raw');assert.equal(legacy.namespace,null);assert.equal((await database.exportRecovery()).journal.outbox[0].future_column,'preserve unknown');await database.activateJournal({namespace:ns,installationId:installation,actorId:actor,enabled:true});assert.equal((await database.readJournal(ns)).outbox.length,0);}finally{await a.driver.close();}
});
test('schema3 pending erasure finishes during upgrade without taking a new private before snapshot',async()=>{
 const a=await schemaThree({pending:true});try{const database=await createDatabase(a.driver);assert.deepEqual((await database.readSnapshot()).entries,{});assert.equal((await a.driver.query('SELECT erase_pending FROM grove_meta')).values[0].erase_pending,0);assert.equal((await a.driver.query('SELECT count(*) AS n FROM grove_revisions WHERE before_json IS NOT NULL')).values[0].n,0);}finally{await a.driver.close();}
});
test('a newer database refuses the schema4 writer before changing any file bytes',async()=>{
 const a=await setup();await a.driver.run('UPDATE grove_meta SET schema_version=99');await a.driver.close();const before=fs.readFileSync(a.file),driver=openDriver(a.file);try{await assert.rejects(createDatabase(driver),/newer|unsupported/);assert.deepEqual(fs.readFileSync(a.file),before);}finally{await driver.close();}
});
test('real SQLITE_FULL rolls back all journal rows and leaves the previous counter usable',async()=>{
 const a=await setup();try{await activate(a);const before=await a.database.exportRecovery(),pages=(await a.driver.query('PRAGMA page_count')).values[0].page_count;await a.driver.query('PRAGMA max_page_count='+pages);await assert.rejects(a.database.commit(0,changes(1),local(operation(1,{note:'保'.repeat(1000000)}))),/full/i);assert.deepEqual(await a.database.exportRecovery(),before);await a.driver.query('PRAGMA max_page_count=1073741823');await a.database.commit(0,changes(1),local(operation(1)));assert.equal((await a.database.readJournal(ns)).state.counter,1);}finally{await a.driver.close();}
});
test('two competing local batches cannot consume the same actor counter and learner revision',async()=>{
 const a=await setup();try{await activate(a);const results=await Promise.allSettled([a.database.commit(0,changes(1),local(operation(1))),a.database.commit(0,changes(2),local(operation(2,{counter:1}),{batchId:uid(51)}))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const j=await a.database.readJournal(ns);assert.equal(j.state.counter,1);assert.equal(j.records.length,1);assert.equal((await a.database.readSnapshot()).profiles.synthetic,changes(1)[0][1]);}finally{await a.driver.close();}
});
test('a later invalid receipt rolls back earlier receipt ACKs in the same real transaction',async()=>{
 const a=await setup();try{const context=await activate(a);await a.database.commit(0,changes(2),local([operation(1),operation(2)]));await assert.rejects(a.database.acknowledgeJournal({context,receipts:[{id:uid(101),sha256:digest(operation(1))},{id:uid(102),sha256:'0'.repeat(64)}]}));const j=await a.database.readJournal(ns);assert.equal(j.outbox.length,2);assert.ok(j.records.every(r=>!r.acknowledged));}finally{await a.driver.close();}
});
test('new activation invalidates a remote callback queued before the new binding commits',async()=>{
 let release,entered,hold=false;const blocked=new Promise(r=>entered=r),gate=new Promise(r=>release=r);const a=await setup({wrap:d=>({...d,async beginTransaction(){if(hold){hold=false;entered();await gate;}return d.beginTransaction();}})});try{const context=await activate(a);hold=true;const wait=a.database.commit(0,changes(1));await blocked;const stage=a.database.stageJournal({context,records:[{raw:operation(1)}],cursor:'stale'});const next=a.database.activateJournal({namespace:'synthetic-b',installationId:installation,actorId:uid(8),enabled:true});release();await wait;await assert.rejects(stage,/context changed/);await next;assert.equal((await a.database.readJournal(ns)).records.length,0);}finally{release?.();await a.driver.close();}
});
test('incomplete, counter-conflicting and cyclic remote histories are retained but cannot project',async()=>{
 for(const rows of [[operation(1,{parents:[uid(999)]})],[operation(1,{parents:[uid(102)]}),operation(2,{parents:[uid(101)]})],[operation(2)],[operation(1),operation(2,{counter:1})]]){
  const a=await setup();try{const context=await activate(a);await a.database.stageJournal({context,records:rows.map(raw=>({raw})),cursor:'unsafe'});const j=await a.database.readJournal(ns);await assert.rejects(a.database.applyJournal({context,expectedRevision:0,expectedJournalRevision:j.state.revision,changes:changes(5)}));assert.equal((await a.database.readSnapshot()).revision,0);assert.equal((await a.database.readJournal(ns)).records.length,rows.length);}finally{await a.driver.close();}
 }
});

test('an unconfirmed rollback poisons journal reads as well as learner reads until reopening',async()=>{
 let armed=false;const a=await setup({wrap:d=>({...d,async commitTransaction(){if(armed)throw Error('Synthetic unconfirmed commit');return d.commitTransaction();},async rollbackTransaction(){if(armed)throw Error('Synthetic unconfirmed rollback');return d.rollbackTransaction();}})});try{await activate(a);armed=true;await assert.rejects(a.database.commit(0,changes(1),local(operation(1))),/recovery/);await assert.rejects(a.database.readSnapshot(),/recovery/);await assert.rejects(a.database.readJournal(ns),/recovery/);}finally{armed=false;if(a.driver.sqlite.isTransaction)await a.driver.rollbackTransaction();await a.driver.close();}
});

test('lost durable erase ACK blocks every journal mutator, including an already-open second handle, until cleanup reopens',async()=>{
 let lose=false;const a=await setup({wrap:d=>({...d,async commitTransaction(){const r=await d.commitTransaction();if(lose){lose=false;throw Error('Synthetic lost durable erase ACK');}return r;}})});let b;
 try{await activate(a);await a.database.commit(0,changes(1),local(operation(1)));b=await setup({file:a.file});const old=await activate(b);lose=true;await assert.rejects(a.database.commit(1,[],{reason:'erase'}),/lost durable erase ACK/);
  for(const database of [a.database,b.database]){
   await assert.rejects(database.activateJournal({namespace:ns,installationId:installation,actorId:actor,enabled:true}),/eras|recover/i);
   await assert.rejects(database.stageJournal({context:old,records:[{raw:operation(1)}],cursor:'late'}));
   await assert.rejects(database.acknowledgeJournal({context:old,receipts:[{id:uid(101),sha256:digest(operation(1))}]}));
  }
  assert.equal((await a.driver.query('SELECT count(*) AS n FROM grove_sync_states')).values[0].n,0);
 }finally{await b?.driver.close();await a.driver.close();}
 const reopened=await setup({file:a.file});try{assert.deepEqual((await reopened.database.readSnapshot()).entries,{});assert.equal((await reopened.driver.query('SELECT erase_pending FROM grove_meta')).values[0].erase_pending,0);assert.equal((await reopened.database.readJournal(ns)).records.length,0);}finally{await reopened.driver.close();}
});
test('a fresh installation must choose a fresh actor while same-installation reactivation preserves its counter',async()=>{
 const a=await setup();try{await activate(a);await a.database.commit(0,changes(1),local(operation(1)));const before=await a.database.exportRecovery();await assert.rejects(activate(a,{installationId:uid(20)}),/actor/i);assert.deepEqual(await a.database.exportRecovery(),before);await activate(a);assert.equal((await a.database.readJournal(ns)).state.counter,1);await activate(a,{installationId:uid(20),actorId:uid(21)});assert.equal((await a.database.readJournal(ns)).state.counter,0);}finally{await a.driver.close();}
});
test('a local append refuses an actor counter already present in received immutable history',async()=>{
 const a=await setup();try{const context=await activate(a);await a.database.stageJournal({context,records:[{raw:operation(1)}],cursor:'candidate'});const before=await a.database.exportRecovery();await assert.rejects(a.database.commit(0,changes(2),local(operation(2,{counter:1}))),/counter|actor/i);assert.deepEqual(await a.database.exportRecovery(),before);}finally{await a.driver.close();}
});
