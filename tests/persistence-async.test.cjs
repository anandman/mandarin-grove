const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Web=require('../adapters/web-storage.js');
let Persistence;try{Persistence=require('../adapters/persistence.js');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
const codec={decodeUtf8:code=>new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(code,'base64')),encodeUtf8:text=>Buffer.from(text,'utf8').toString('base64')};
const fixture=name=>JSON.parse(fs.readFileSync('tests/fixtures/backups/'+name,'utf8'));
const encode=value=>codec.encodeUtf8(JSON.stringify(value));
function memory(entries={}){
 const values=new Map(Object.entries(entries));let fail=null;
 return {getItem:key=>values.get(key)??null,setItem(key,value){if(fail?.(key,value))throw Error('Synthetic storage failure');values.set(key,String(value));},removeItem(key){if(fail?.(key,null))throw Error('Synthetic storage failure');values.delete(key);},key:index=>[...values.keys()][index]??null,get length(){return values.size;},failWhen:fn=>fail=fn,snapshot:()=>Object.fromEntries([...values].sort())};
}
function seed(){const f=fixture('original-v1.json');return {zh_profiles:JSON.stringify(f.PR),...Object.fromEntries(Object.entries(f.data).map(([id,raw])=>['zh_p_'+id,raw])),zh_voice:'voice:synthetic',zh_appearance:'dark',zh_bk:'123',zh_feedback_v1:'[{"id":"old","delivery":{"state":"pending"},"future":{"keep":true}}]',zh_future:'unknown retained bytes',unrelated:'outside Grove'};}
function setup(options={}){
 assert.equal(typeof Persistence?.createRepository,'function','Promise persistence implementation is available');
 const storage=options.storage||memory(seed()),repository=Web.createRepository({storage,codec,now:()=>123,makeId:()=> 'fixed',migrate:options.migrate});
 const facade=Persistence.createRepository({repository:options.wrap?options.wrap(repository):repository,ready:options.ready});return {storage,repository,facade};
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('startup waits for the selected platform and never writes through a failed readiness gate',async()=>{
 const gate=deferred(),{facade,storage}=setup({ready:()=>gate.promise}),before=storage.snapshot();let finished=false;
 const pending=facade.createProfile({name:'Synthetic',gr:'2'}).then(value=>{finished=true;return value;});
 await tick();assert.equal(finished,false);assert.deepEqual(storage.snapshot(),before);
 gate.reject(Error('Database unavailable'));await assert.rejects(pending,/Database unavailable/);
 await assert.rejects(facade.readRegistry(),/Database unavailable/);assert.deepEqual(storage.snapshot(),before);
});

test('pending profile save captures owner and candidate before later edits and resolves only after durable acknowledgement',async()=>{
 const gate=deferred();let entered=false;
 const {facade,storage}=setup({wrap:r=>({...r,saveProfile:async(...args)=>{entered=true;await gate.promise;return r.saveProfile(...args);}})});
 const registry=await facade.readRegistry(),owner=registry.cur,candidate=await facade.readProfile(owner),before=storage.getItem('zh_p_'+owner),other=storage.getItem('zh_p_synthetic-b');
 candidate.stars=160;const options={expectedRevision:before};let confirmed=false;
 const pending=facade.saveProfile(owner,candidate,options).then(value=>{confirmed=true;return value;});
 candidate.stars=999;registry.cur='synthetic-b';options.expectedRevision='not the captured revision';
 await tick();assert.equal(entered,true);assert.equal(confirmed,false);assert.equal(storage.getItem('zh_p_'+owner),before);
 gate.resolve();const saved=await pending;assert.equal(saved.stars,160);assert.equal(JSON.parse(storage.getItem('zh_p_'+owner)).stars,160);assert.equal(storage.getItem('zh_p_synthetic-b'),other);
});

test('rejected commit leaves durable bytes unchanged and does not poison a queued retry',async()=>{
 const gate=deferred();let calls=0;
 const {facade,storage}=setup({wrap:r=>({...r,saveProfile:async(...args)=>{if(++calls===1)await gate.promise;return r.saveProfile(...args);}})});
 const registry=await facade.readRegistry(),candidate=await facade.readProfile(registry.cur),before=storage.snapshot();candidate.stars=160;
 const first=facade.saveProfile(registry.cur,candidate);const rejected=assert.rejects(first,/Synthetic commit rejection/);
 const retry=facade.saveProfile(registry.cur,candidate);await tick();assert.equal(calls,1);assert.deepEqual(storage.snapshot(),before);
 gate.reject(Error('Synthetic commit rejection'));await rejected;const result=await retry;assert.equal(result.stars,160);assert.equal(calls,2);
});

test('registry and grade settings remain all-or-none when a delayed native-shaped commit rejects',async()=>{
 const gate=deferred(),{facade,storage}=setup({wrap:r=>({...r,saveChildSettings:async(...args)=>{await gate.promise;return r.saveChildSettings(...args);}})});
 const registry=await facade.readRegistry(),candidate=await facade.readProfile(registry.cur),before=storage.snapshot();registry.list[0].gr='4';candidate.cfg.quiz='祖正';
 const saving=facade.saveChildSettings(registry.cur,registry,candidate),rejected=assert.rejects(saving,/disk full/);await tick();assert.deepEqual(storage.snapshot(),before);
 gate.reject(Error('disk full'));await rejected;assert.deepEqual(storage.snapshot(),before);
 const working=setup({storage}).facade;await working.readRegistry();await working.readProfile(registry.cur);const result=await working.saveChildSettings(registry.cur,registry,candidate);
 assert.equal(result.registry.list[0].gr,'4');assert.equal(result.profile.cfg.quiz,'祖正');
});

test('every failed settings transaction rolls back the exact registry and both learner records',async()=>{
 for(let failure=1;failure<=4;failure++){
  const {facade,storage}=setup(),registry=await facade.readRegistry(),candidate=await facade.readProfile(registry.cur),before=storage.snapshot();
  registry.list[0].name='Changed name';registry.list[0].gr='4';candidate.cfg.quiz='祖正';let writes=0;storage.failWhen(()=>++writes===failure);
  await assert.rejects(facade.saveChildSettings(registry.cur,registry,candidate));assert.deepEqual(storage.snapshot(),before,'failed write '+failure);
 }
});

test('expectedRevision options reject a stale web commit rather than overwrite fresh progress',async()=>{
 const {facade,storage}=setup(),registry=await facade.readRegistry(),candidate=await facade.readProfile(registry.cur),revision=storage.getItem('zh_p_'+registry.cur);
 const remote=JSON.parse(revision);remote.stars=600;storage.setItem('zh_p_'+registry.cur,JSON.stringify(remote));candidate.stars=160;const before=storage.snapshot();
 await assert.rejects(facade.saveProfile(registry.cur,candidate,{expectedRevision:revision}),/changed|conflict/i);assert.deepEqual(storage.snapshot(),before);
});

test('snapshot reads do not refresh a stale edit baseline and hide conflicting changes',async()=>{
 const {facade,storage}=setup(),registry=await facade.readRegistry(),candidate=await facade.readProfile(registry.cur);
 const remote=JSON.parse(storage.getItem('zh_p_'+registry.cur));remote.stars=500;storage.setItem('zh_p_'+registry.cur,JSON.stringify(remote));
 const snapshot=await facade.peekProfile(registry.cur);assert.equal(snapshot.stars,500);snapshot.stars=999;
 candidate.stars=170;const before=storage.snapshot();await assert.rejects(facade.saveProfile(registry.cur,candidate),/changed|conflict/i);assert.deepEqual(storage.snapshot(),before);
});

test('both frozen backups roundtrip exact original raw data and unknown envelope fields through the async boundary',async()=>{
 for(const name of ['original-v1.json','grove-v1.json']){
  const {facade,storage}=setup(),f=fixture(name);f.futureEnvelope={keep:['绿',null,{value:17}]};const device=storage.snapshot();
  const preview=await facade.previewBackup(encode(f));assert.equal(preview.registry.list.length,2);assert.deepEqual(storage.snapshot(),device);
  await facade.importBackup(encode(f));assert.deepEqual(JSON.parse(codec.decodeUtf8(await facade.exportBackup())),f);
  for(const key of ['zh_voice','zh_appearance','zh_bk','zh_feedback_v1','zh_future','unrelated'])assert.equal(storage.getItem(key),device[key]);
 }
});

test('invalid inactive child fails full prevalidation without replacing any durable value',async()=>{
 const {facade,storage}=setup(),bad=fixture('grove-v1.json'),before=storage.snapshot();bad.data['synthetic-b']='{broken';
 await assert.rejects(facade.previewBackup(encode(bad)));await assert.rejects(facade.importBackup(encode(bad)));assert.deepEqual(storage.snapshot(),before);
});

test('stale backup comparison rejects replacement atomically and summary reads keep registry edit baselines',async()=>{
 const {facade,storage}=setup(),registry=await facade.readRegistry(),preview=await facade.backupSummary();
 const remote=JSON.parse(storage.getItem('zh_profiles'));remote.list[0].name='Remote edit';storage.setItem('zh_profiles',JSON.stringify(remote));const before=storage.snapshot();
 await assert.rejects(facade.importBackup(encode(fixture('grove-v1.json')),{expectedStamp:preview.stamp}),/changed/i);assert.deepEqual(storage.snapshot(),before);
 const summary=await facade.backupSummary();assert.equal(summary.registry.list[0].name,'Remote edit');registry.list[0].name='Stale local edit';
 await assert.rejects(facade.saveRegistry(registry),/changed|conflict/i);assert.deepEqual(storage.snapshot(),before);
});

test('preferences and report records use separate namespaces and concurrent reports cannot overwrite one another',async()=>{
 const {facade,storage}=setup(),backup=await facade.exportBackup();
 assert.equal(await facade.readPreference('zh_voice'),'voice:synthetic');await facade.writePreference('zh_appearance','light');
 await Promise.all([facade.saveReport({id:'one',delivery:{state:'local'},future:['keep']}),facade.saveReport({id:'two',delivery:{state:'failed'}})]);
 assert.deepEqual((await facade.readReports()).map(r=>r.id),['old','one','two']);assert.deepEqual((await facade.readReports())[0].future,{keep:true});
 assert.equal(await facade.exportBackup(),backup);assert.equal(storage.getItem('zh_appearance'),'light');
 await assert.rejects(facade.writePreference('zh_p_synthetic-a','overwrite'),/preference/i);assert.equal(await facade.exportBackup(),backup);
});

test('full pending report queue refuses a new report and corrupt reports remain recoverable',async()=>{
 const {facade,storage}=setup(),rows=Array.from({length:50},(_,n)=>({id:'pending-'+n,delivery:{state:'pending'}}));await facade.saveReports(rows);let before=storage.snapshot();
 await assert.rejects(facade.saveReport({id:'new',delivery:{state:'local'}}),/full/i);assert.deepEqual(storage.snapshot(),before);
 storage.setItem('zh_feedback_v1','{corrupt original report bytes');before=storage.snapshot();await assert.rejects(facade.saveReport({id:'new'}));assert.deepEqual(storage.snapshot(),before);
 const recovery=await facade.exportRecovery();assert.equal(recovery.storage.zh_feedback_v1,'{corrupt original report bytes');assert.equal(recovery.storage.zh_future,'unknown retained bytes');assert.equal(recovery.storage.unrelated,undefined);
});

test('erase failure retains every managed value and an acknowledged erase leaves unrelated storage alone',async()=>{
 const count=Object.keys(seed()).length-1;
 for(let failure=1;failure<=count+2;failure++){
  const {facade,storage}=setup(),before=storage.snapshot();let writes=0;storage.failWhen(()=>++writes===failure);
  await assert.rejects(facade.eraseLocal(),/Synthetic storage failure/);assert.deepEqual(storage.snapshot(),before,'failed write '+failure);
 }
 const {facade,storage}=setup();assert.equal(await facade.eraseLocal(),true);assert.deepEqual(storage.snapshot(),{unrelated:'outside Grove'});
});

test('failed erase rollback keeps its original recovery snapshot and cannot expose an empty registry',async()=>{
 const {facade,storage}=setup(),before=storage.snapshot();storage.failWhen(key=>key==='zh_voice');
 await assert.rejects(facade.eraseLocal(),/recovery/i);await assert.rejects(facade.readRegistry(),/recovery/i);
 const recovery=await facade.exportRecovery(),journal=JSON.parse(recovery.storage.zh_import_recovery_v1);
 assert.equal(journal.operation,'erase');assert.deepEqual(Object.fromEntries(journal.before),Object.fromEntries(Object.entries(before).filter(([key])=>key!=='unrelated')));
 storage.failWhen(null);assert.equal(await facade.recoverImport(),true);assert.deepEqual(storage.snapshot(),before);
});

test('absent native capabilities reject instead of falling back to browser storage',async()=>{
 assert.equal(typeof Persistence?.createRepository,'function');
 const facade=Persistence.createRepository({repository:{readRegistry:()=>({cur:null,list:[]})}});
 await assert.rejects(facade.writePreference('zh_voice','mainland'),/implement|support|unavailable/i);
});
