// Installed-SDK journal proof. All databases are separately named synthetic
// fixtures; never erase/replace the app's learner database or selected files.
window.GroveNativeJournal=async function(){
 const check=(v,m)=>{if(!v)throw Error(m);},equal=(a,b,m)=>check(JSON.stringify(a)===JSON.stringify(b),m),reject=async(p,m,pattern)=>{let error;try{await p;}catch(e){error=e;}check(!!error,m);if(pattern)check(pattern.test(String(error.message||error)),m+' returned unexpected error: '+String(error));};
 check(document.documentElement.dataset.nativeInternalTests==='true','Internal package only');
 const beforeBackup=await backup(),beforeReports=JSON.stringify(await GROVE_REPOSITORY.readReports()),run=crypto.randomUUID().replaceAll('-','_'),name='grove_journal_synthetic_'+run;
 const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),actor=uid(1),installation=uid(2),profile=uid(3),ns='synthetic-journal-account';
 const hash=async raw=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),b=>b.toString(16).padStart(2,'0')).join('');
 const marker='SYNTHETIC_JOURNAL_PRIVATE_'+run,raw='\ufeff'+JSON.stringify({schema:1,id:uid(101),deviceId:actor,counter:1,parents:[],profileUuid:profile,kind:'answerRecorded',at:-100,policyVersion:1,payload:{synthetic:true,note:marker,future:{keep:'绿'}}})+'\r\n';
 const metadata={journal:{namespace:ns,installationId:installation,actorId:actor,expectedCounter:0,batchId:uid(50),records:[raw]}};
 const receipt={name,marker,checks:[],passed:false};let fixture=await GroveNativeTest.journalFixture(name),c=fixture.connection,database;
 try{
  await c.execute(`CREATE TABLE grove_meta(id INTEGER PRIMARY KEY,schema_version INTEGER NOT NULL,revision INTEGER NOT NULL,erase_pending INTEGER NOT NULL,future_meta TEXT);
   INSERT INTO grove_meta VALUES(1,3,7,0,'unknown metadata');
   CREATE TABLE grove_entries(namespace TEXT NOT NULL,key TEXT PRIMARY KEY,value TEXT NOT NULL);
   CREATE TABLE grove_revisions(revision INTEGER PRIMARY KEY,reason TEXT NOT NULL,created INTEGER NOT NULL,changes_hash TEXT NOT NULL,before_json TEXT);
   CREATE TABLE grove_originals(sha256 TEXT PRIMARY KEY,code TEXT NOT NULL,payload_hash TEXT NOT NULL,created INTEGER NOT NULL,code_json TEXT NOT NULL);
   CREATE TABLE grove_outbox(operation_id TEXT PRIMARY KEY,payload TEXT NOT NULL,created INTEGER NOT NULL,future_column TEXT);`,false);
  await c.run('INSERT INTO grove_entries VALUES(?,?,?)',['progress','zh_probe',marker],false);
  await c.run('INSERT INTO grove_outbox VALUES(?,?,?,?)',['legacy-unknown',marker,1,'unknown column'],false);
  let lose=false;
  const wrap=driver=>({execute:driver.execute.bind(driver),run:driver.run.bind(driver),query:driver.query.bind(driver),beginTransaction:driver.beginTransaction.bind(driver),rollbackTransaction:driver.rollbackTransaction.bind(driver),isTransactionActive:driver.isTransactionActive.bind(driver),async commitTransaction(){const r=await driver.commitTransaction();if(lose){lose=false;throw Error('Synthetic actual COMMIT ACK lost');}return r;}});
  database=await fixture.create(wrap);equal((await database.readSnapshot()).revision,8,'Schema3 migration revision');equal((await database.readSnapshot()).entries.zh_probe,marker,'Legacy learner bytes');
  const legacy=(await c.query('SELECT * FROM grove_outbox',[])).values.find(r=>r.operation_id==='legacy-unknown');equal(legacy.future_column,'unknown column','Unknown legacy column');equal(legacy.namespace,null,'Unbound legacy row retained');receipt.checks.push('actual schema3→4 migration preserves learner/unknown columns/unbound outbox');
  let context=await database.activateJournal({namespace:ns,installationId:installation,actorId:actor,enabled:true});
  await c.execute("CREATE TRIGGER fail_journal BEFORE INSERT ON grove_outbox BEGIN SELECT RAISE(ABORT,'synthetic outbox failure'); END;",false);
  await reject(database.commit(8,[['zh_probe','failed']],metadata),'Actual outbox abort');equal((await database.readSnapshot()).revision,8,'Atomic learner rollback');equal((await database.readJournal(ns)).state.counter,0,'Atomic counter rollback');equal((await database.readJournal(ns)).records.length,0,'Atomic operation rollback');
  await c.execute('DROP TRIGGER fail_journal;',false);receipt.checks.push('real SQLite trigger rejection rolls back learner/counter/operation/outbox');
  lose=true;await reject(database.commit(8,[['zh_probe',marker]],metadata),'Lost actual COMMIT ACK');await fixture.close();fixture=await GroveNativeTest.journalFixture(name);c=fixture.connection;database=await fixture.create();
  equal((await database.commit(8,[['zh_probe',marker]],metadata)).revision,9,'Same batch commits once after reopen');equal((await database.readJournal(ns)).records[0].raw,raw,'Exact raw BOM/CRLF');equal((await database.readJournal(ns)).state.counter,1,'One counter');
  await reject(database.activateJournal({namespace:ns,installationId:uid(20),actorId:actor,enabled:true}),'New installation cannot reuse actor',/actor/i);
  context=await database.activateJournal({namespace:ns,installationId:installation,actorId:actor,enabled:true});equal((await database.readJournal(ns)).state.counter,1,'Same installation counter retained');receipt.checks.push('new installation actor reuse rejected; same-installation reactivation retains counter');
  await reject(database.acknowledgeJournal({context,receipts:[{id:uid(101),sha256:'0'.repeat(64)}]}),'Wrong hash cannot ACK');
  await database.acknowledgeJournal({context,receipts:[{id:uid(101),sha256:await hash(raw)}]});equal((await database.readJournal(ns)).outbox.length,0,'Exact ACK removes pending delivery only');equal((await database.readSnapshot()).revision,9,'ACK is not learner edit');receipt.checks.push('actual lost COMMIT ACK/reopen retry once; exact BOM/hash/ACK');
  await database.stageJournal({context,records:[{raw,sha256:await hash(raw)}],cursor:{token:'\ufeffnext',future:{keep:true}}});let j=await database.readJournal(ns);equal(j.records.length,1,'Exact download dedupes');equal(j.state.cursor,null,'Receive cursor not yet applied');
  await fixture.close();fixture=await GroveNativeTest.journalFixture(name);c=fixture.connection;database=await fixture.create();context=(await database.readJournal(ns)).context;j=await database.readJournal(ns);equal(j.state.pendingCursor,{token:'\ufeffnext',future:{keep:true}},'Staged cursor survives connection reopen');
  await database.applyJournal({context,expectedRevision:9,expectedJournalRevision:j.state.revision,changes:[['zh_probe',marker+'-projected']]});equal((await database.readJournal(ns)).state.cursor,{token:'\ufeffnext',future:{keep:true}},'Projection commits applied cursor');receipt.checks.push('receive bytes/pending cursor survive reopen; cursor+projection commit together');
  const beforeFull=await database.exportRecovery(),pages=(await c.query('PRAGMA page_count',[])).values.find(r=>typeof r.page_count==='number').page_count;
  await c.query('PRAGMA max_page_count='+pages,[]);
  try{const huge=JSON.parse(raw.slice(1));huge.id=uid(102);huge.counter=2;huge.payload.note='保'.repeat(1000000);await reject(database.commit(10,[['zh_probe','never']],{journal:{...metadata.journal,expectedCounter:1,batchId:uid(51),records:[JSON.stringify(huge)]}}),'Actual native FULL',/full/i);equal(await database.exportRecovery(),beforeFull,'FULL rolls back complete recovery/counter/outbox');}finally{await c.query('PRAGMA max_page_count=1073741823',[]);}
  receipt.checks.push('actual native SQLITE_FULL preserves complete acknowledged journal and learner state');
  const remote=JSON.parse(raw.slice(1));remote.id=uid(102);remote.counter=2;await database.stageJournal({context,records:[{raw:JSON.stringify(remote)}],cursor:'counter-check'});remote.id=uid(103);await reject(database.commit(10,[['zh_probe','never']],{journal:{...metadata.journal,expectedCounter:1,batchId:uid(52),records:[JSON.stringify(remote)]}}),'Received actor counter cannot be reused locally',/counter/i);
  receipt.checks.push('local append rejects an actor counter already present in received immutable history');
  const other=await database.activateJournal({namespace:'synthetic-other-account',installationId:installation,actorId:uid(9),enabled:true});await reject(database.stageJournal({context,records:[{raw}],cursor:'late'}),'Old context rejected');equal((await database.readJournal(other.namespace)).records.length,0,'No cross-account records');
  database=await fixture.create(wrap);lose=true;await reject(database.commit(10,[],{reason:'erase'}),'Lost durable erase COMMIT ACK');await reject(database.activateJournal({namespace:ns,installationId:installation,actorId:actor,enabled:true}),'Pending erase blocks journal activation',/eras|recover/i);await fixture.close();fixture=await GroveNativeTest.journalFixture(name);c=fixture.connection;database=await fixture.create();receipt.checks.push('lost durable erase ACK cannot recreate journal rows; reopen finishes physical cleanup');await reject(database.acknowledgeJournal({context,receipts:[{id:uid(101),sha256:await hash(raw)}]}),'Erase invalidates callbacks');const erased=await database.exportRecovery();check(!JSON.stringify(erased).includes(marker),'No logical private marker');
  receipt.checks.push('account generation rejects stale callbacks; explicit synthetic erase clears every journal table');
  equal(await backup(),beforeBackup,'Actual app learner backup unchanged');equal(JSON.stringify(await GROVE_REPOSITORY.readReports()),beforeReports,'Actual app raw reports unchanged');receipt.checks.push('app learner backup and raw reports unchanged');receipt.passed=true;return receipt;
 }finally{await fixture.close();}
};

// The host kills the actual app only after the requested real SQLite boundary.
window.GroveNativeJournalKill={phase:null,async begin(name,stage){
 if(!['before','after','receive'].includes(stage))throw Error('Unsupported synthetic kill phase');
 const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),namespace='synthetic-journal-kill',installationId=uid(2),actorId=uid(1);
 const fixture=await GroveNativeTest.journalFixture(name),c=fixture.connection;let armed=false;
 const database=await fixture.create(driver=>({execute:driver.execute.bind(driver),run:driver.run.bind(driver),query:driver.query.bind(driver),beginTransaction:driver.beginTransaction.bind(driver),rollbackTransaction:driver.rollbackTransaction.bind(driver),isTransactionActive:driver.isTransactionActive.bind(driver),async commitTransaction(){if(armed&&stage==='before'){GroveNativeJournalKill.phase='before';await new Promise(()=>{});}const r=await driver.commitTransaction();if(armed&&stage==='after'){GroveNativeJournalKill.phase='after';await new Promise(()=>{});}return r;}}));
 await database.commit(0,[['zh_probe','prior']]);const context=await database.activateJournal({namespace,installationId,actorId,enabled:true});
 const raw=JSON.stringify({schema:1,id:uid(101),deviceId:actorId,counter:1,parents:[],profileUuid:uid(3),kind:'answerRecorded',at:0,policyVersion:1,payload:{synthetic:true,future:{keep:'绿'}}});
 if(stage==='receive'){await database.stageJournal({context,records:[{raw}],cursor:{token:'pending-after-kill'}});GroveNativeJournalKill.phase='receive';return true;}
 armed=true;window.groveSyntheticJournalPending=database.commit(1,[['zh_probe','saved']],{journal:{namespace,installationId,actorId,expectedCounter:0,batchId:uid(50),records:[raw]}});void window.groveSyntheticJournalPending.catch(()=>{});return true;
},async recover(name,stage){
 const fixture=await GroveNativeTest.journalFixture(name);try{const database=await fixture.create(),s=await database.readSnapshot(),j=await database.readJournal('synthetic-journal-kill');
 const assert=(v,m)=>{if(!v)throw Error(m);};assert(s.revision===(stage==='after'?2:1),'Atomic learner revision after OS kill');assert(s.entries.zh_probe===(stage==='after'?'saved':'prior'),'Atomic learner value after OS kill');assert(j.state.counter===(stage==='after'?1:0),'Atomic actor counter');assert(j.records.length===(stage==='before'?0:1),'Atomic immutable operation');assert(j.outbox.length===(stage==='after'?1:0),'Atomic outbox');assert(j.state.cursor===null,'Applied cursor never races projection');
 if(stage==='receive'){assert(j.state.pendingCursor.token==='pending-after-kill','Pending receive cursor survives actual OS kill');await database.applyJournal({context:j.context,expectedRevision:1,expectedJournalRevision:j.state.revision,changes:[['zh_probe','saved']]});assert((await database.readJournal('synthetic-journal-kill')).state.cursor.token==='pending-after-kill','Fresh process applies projection and cursor');}
 return {passed:true,name,stage,learnerRevisionBeforeRecovery:s.revision,records:j.records.length,outbox:j.outbox.length,counter:j.state.counter};
 }finally{await fixture.close();}
}};
