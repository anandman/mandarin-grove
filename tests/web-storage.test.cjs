const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
let createRepository;try{({createRepository}=require('../adapters/web-storage.js'));}catch{}
const codec={decodeUtf8:code=>new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(code,'base64')),encodeUtf8:text=>Buffer.from(text,'utf8').toString('base64')};
const fixture=name=>JSON.parse(fs.readFileSync('tests/fixtures/backups/'+name,'utf8'));
const code=value=>codec.encodeUtf8(JSON.stringify(value));
function storage(entries={}){const values=new Map(Object.entries(entries));let writes=0,failAt=0,failKey=null;return {values,getItem:k=>values.get(k)??null,setItem(k,v){writes++;if(writes===failAt||k===failKey)throw Error('Synthetic quota failure');values.set(k,String(v));},removeItem(k){writes++;if(writes===failAt||k===failKey)throw Error('Synthetic quota failure');values.delete(k);},get length(){return values.size;},key:i=>[...values.keys()][i]??null,failAt:n=>{writes=0;failAt=n;},failKey:k=>{failKey=k;},snapshot:()=>Object.fromEntries([...values].sort())};}
function seed(){const f=fixture('original-v1.json');return {'zh_profiles':JSON.stringify(f.PR),...Object.fromEntries(Object.entries(f.data).map(([id,raw])=>['zh_p_'+id,raw])),zh_voice:'voice:synthetic-missing',zh_appearance:'dark',zh_feedback_v1:'[{"pending":true}]',zh_future:'keep',zh_p_orphan:'{"sentinel":true}',unrelated:'keep'};}
const repo=s=>{assert.equal(typeof createRepository,'function');return createRepository({storage:s,codec,now:()=>123,makeId:()=> 'fixed'});};
test('complete two-child import/export preserves raw state, metadata and untouched device/orphan keys',()=>{
 const s=storage(seed()),r=repo(s),f=fixture('grove-v1.json');f.futureEnvelope={keep:['绿',null]};r.importBackup(code(f));
 assert.deepEqual(JSON.parse(codec.decodeUtf8(r.exportBackup())),f);
 for(const key of ['zh_voice','zh_appearance','zh_feedback_v1','zh_future','zh_p_orphan','unrelated'])assert.equal(s.getItem(key),seed()[key]);
 assert.equal(s.getItem('zh_import_recovery_v1'),null);
});
test('malformed inactive child and preview never write a single byte',()=>{
 const s=storage(seed()),r=repo(s),before=s.snapshot(),bad=fixture('grove-v1.json');bad.data['synthetic-b']='{broken';
 assert.throws(()=>r.importBackup(code(bad)),Error);assert.deepEqual(s.snapshot(),before);
 r.previewBackup(code(fixture('grove-v1.json')));assert.deepEqual(s.snapshot(),before);
});
test('failure at every import write rolls back exact previous values and never reports success',()=>{
 for(let n=1;n<=6;n++){const s=storage(seed()),r=repo(s),before=s.snapshot();s.failAt(n);assert.throws(()=>r.importBackup(code(fixture('grove-v1.json'))),Error,'write '+n);assert.deepEqual(s.snapshot(),before,'rollback at write '+n);}
});
test('failed rollback retains original values in journal, blocks reads, and recovers on restart',()=>{
 const s=storage(seed()),before=s.snapshot(),r=repo(s);s.failKey('zh_profiles');
 assert.throws(()=>r.importBackup(code(fixture('grove-v1.json'))),/recover/i);
 const journal=JSON.parse(s.getItem('zh_import_recovery_v1'));assert.equal(journal.version,1);assert.ok(journal.before.some(([k,v])=>k==='zh_profiles'&&v===before.zh_profiles));
 assert.throws(()=>r.readRegistry(),/recover/i);s.failKey(null);repo(s).recoverImport();assert.deepEqual(s.snapshot(),before);
});
test('interrupted imports recover before exposing partially imported registry',()=>{
 for(let applied=0;applied<=4;applied++){
  const entries=seed(),s=storage(entries),f=fixture('grove-v1.json');
  const changes=[['zh_p_synthetic-a',f.data['synthetic-a']],['zh_p_synthetic-b',f.data['synthetic-b']],['zh_backup_meta_v1','{}'],['zh_profiles',JSON.stringify(f.PR)]];
  const before=changes.map(([k])=>[k,s.getItem(k)]);s.values.set('zh_import_recovery_v1',JSON.stringify({version:1,id:'interrupted',before}));
  for(const [k,v]of changes.slice(0,applied))s.values.set(k,v);
  const r=repo(s);assert.deepEqual(r.readRegistry(),JSON.parse(entries.zh_profiles));assert.deepEqual(s.snapshot(),storage(entries).snapshot());
 }
});
test('one-key bootstrap preserves cfg and original blob and is idempotent',()=>{
 const raw=fixture('original-v1.json').data['synthetic-a'],s=storage({owenzh_v1:raw,zh_voice:'recorded'}),r=repo(s);
 const first=r.readRegistry();assert.equal(first.list.length,1);assert.deepEqual(r.readProfile(first.cur).cfg,JSON.parse(raw).cfg);assert.equal(s.getItem('owenzh_v1'),raw);
 const before=s.snapshot();assert.deepEqual(r.readRegistry(),first);assert.deepEqual(s.snapshot(),before);assert.equal(s.getItem('zh_voice'),'recorded');
});
test('one-key bootstrap never overwrites an orphaned original profile with the same ID',()=>{
 const raw=fixture('original-v1.json').data['synthetic-a'],orphan='{"stars":91,"cfg":{}}',s=storage({owenzh_v1:raw,zh_p_p1:orphan}),r=repo(s);
 const registry=r.readRegistry();assert.notEqual(registry.cur,'p1');assert.equal(s.getItem('zh_p_p1'),orphan);assert.deepEqual(r.readProfile(registry.cur).cfg,JSON.parse(raw).cfg);
});
test('stale disjoint saves preserve fresh choices; conflicting edits refuse without overwriting either child',()=>{
 const s=storage(seed()),a=repo(s),b=repo(s);a.readRegistry();b.readRegistry();const x=a.readProfile('synthetic-a'),y=b.readProfile('synthetic-a');
 x.cfg.cramUnits={'2':[]};a.saveProfile('synthetic-a',x);y.stars++;b.saveProfile('synthetic-a',y);
 assert.deepEqual(JSON.parse(s.getItem('zh_p_synthetic-a')).cfg.cramUnits,{'2':[]});assert.equal(JSON.parse(s.getItem('zh_p_synthetic-a')).stars,150);
 const z=a.readProfile('synthetic-a'),w=b.readProfile('synthetic-a');z.stars+=2;a.saveProfile('synthetic-a',z);w.stars+=3;const before=s.snapshot();assert.throws(()=>b.saveProfile('synthetic-a',w),/another tab|conflict/i);assert.deepEqual(s.snapshot(),before);
});
test('profile creation handles same-time ID collisions, deletion guards last child, failed lifecycle commits retain state',()=>{
 const s=storage(),r=repo(s);const a=r.createProfile({name:'A',gr:'2',av:'🐼'}),b=r.createProfile({name:'B',gr:'4',av:'🐳'});assert.notEqual(a.id,b.id);assert.equal(r.readRegistry().list.length,2);
 const before=s.snapshot();s.failAt(2);assert.throws(()=>r.deleteProfile(a.id),Error);assert.deepEqual(s.snapshot(),before);
 r.deleteProfile(a.id);assert.equal(r.readRegistry().cur,b.id);assert.throws(()=>r.deleteProfile(b.id),/last|one child/i);
});
test('invalid durable state and recovery journals never get replaced by blank progress',()=>{
 const s=storage(seed()),r=repo(s);s.values.set('zh_p_synthetic-a','broken');const before=s.snapshot();assert.throws(()=>r.readProfile('synthetic-a'),Error);assert.deepEqual(s.snapshot(),before);
 s.values.set('zh_import_recovery_v1',JSON.stringify({version:1,id:'bad',before:[['unrelated','overwrite']]}));const old=s.snapshot();assert.throws(()=>repo(s).recoverImport(),Error);assert.deepEqual(s.snapshot(),old);
});
test('a concurrent write during import is retained rather than overwritten by rollback',()=>{
 const s=storage(seed()),r=repo(s),set=s.setItem.bind(s);let injected=false;
 s.setItem=(key,value)=>{set(key,value);if(key==='zh_import_recovery_v1'&&!injected){injected=true;s.values.set('zh_p_synthetic-a','{"stars":999,"cfg":{}}');}};
 assert.throws(()=>r.importBackup(code(fixture('grove-v1.json'))),/recover|changed/i);
 assert.equal(JSON.parse(s.getItem('zh_p_synthetic-a')).stars,999);assert.ok(s.getItem('zh_import_recovery_v1'),'Original values remain recoverable');
});
test('a different tab cannot recover an actively leased import; expired recovery checks proposed values',()=>{
 const entries=seed(),s=storage(entries),before=[['zh_p_synthetic-a',entries['zh_p_synthetic-a']]];
 s.values.set('zh_import_recovery_v1',JSON.stringify({version:1,id:'other',owner:'other-tab',phase:'writing',leaseUntil:1000,before,after:[['zh_p_synthetic-a','{}']]}));
 assert.throws(()=>repo(s).readRegistry(),/another tab|saving/i);assert.ok(s.getItem('zh_import_recovery_v1'));
 createRepository({storage:s,codec,now:()=>1001,makeId:()=> 'new'}).recoverImport();assert.deepEqual(s.snapshot(),storage(entries).snapshot());
});
test('switching to an existing child with missing progress refuses rather than fabricating a blank snapshot',()=>{
 const entries=seed();delete entries['zh_p_synthetic-b'];const s=storage(entries),r=repo(s),registry=r.readRegistry(),before=s.snapshot();registry.cur='synthetic-b';assert.throws(()=>r.saveRegistry(registry),/missing|recover/i);assert.deepEqual(s.snapshot(),before);
});
test('all imported profiles pass initialization preflight before any durable replacement',()=>{
 const s=storage(seed()),before=s.snapshot(),r=createRepository({storage:s,codec,migrate:(value,_now,profile)=>{if(profile.id==='synthetic-b')throw Error('Unsupported saved evidence');return value;}});
 assert.throws(()=>r.importBackup(code(fixture('grove-v1.json'))),/Unsupported saved evidence/);assert.deepEqual(s.snapshot(),before);
});
for(const operation of ['exportBackup','readProfile'])test(operation+' cannot refresh the caller’s stale registry baseline and remove a remotely added child',()=>{
 const s=storage(seed()),first=repo(s),second=repo(s),local=first.readRegistry();
 const added=second.createProfile({name:'Added elsewhere',gr:'4',av:'🐳'});local.localNote='Metadata from this tab';
 if(operation==='readProfile')first.readProfile(local.cur);else first.exportBackup();
 const result=first.saveRegistry(local);assert.equal(result.list.some(p=>p.id===added.id),true);assert.equal(result.cur,added.id);assert.equal(result.localNote,local.localNote);assert.ok(s.getItem('zh_p_'+added.id));
});
test('fresh registry summary reads validate and clone without refreshing the edit baseline',()=>{
 const s=storage(seed()),r=repo(s),local=r.readRegistry(),remote=JSON.parse(s.getItem('zh_profiles'));
 remote.list[0].name='Remote name';s.setItem('zh_profiles',JSON.stringify(remote));
 assert.equal(typeof r.peekRegistry,'function');const summary=r.peekRegistry();assert.equal(summary.list[0].name,'Remote name');summary.list[0].name='Unpersisted summary';assert.equal(JSON.parse(s.getItem('zh_profiles')).list[0].name,'Remote name');
 local.list[0].name='Conflicting local name';assert.throws(()=>r.saveRegistry(local),/conflict|changed/i,'Summary cannot move the merge baseline past an unseen remote edit');
});
