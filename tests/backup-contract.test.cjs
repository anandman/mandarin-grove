// Immutable synthetic snapshots: never replace these with a child's backup.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRepository}=require('../adapters/web-storage.js');
const directory=path.join(__dirname,'fixtures/backups');
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
for(const fixture of manifest.fixtures){
 test(fixture.path+': frozen full-profile export is lossless and leaves storage untouched',()=>{
  const bytes=fs.readFileSync(path.join(directory,fixture.path));
  assert.equal(bytes.length,fixture.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),fixture.sha256);
  const snapshot=JSON.parse(bytes),store=new Map(Object.entries(snapshot.data).map(([id,raw])=>['zh_p_'+id,raw]));
  store.set('unrelated','keep');
  store.set('zh_profiles',JSON.stringify(snapshot.PR));
  const before=JSON.stringify([...store]),profiles=JSON.stringify(snapshot.PR);
  const repository=createRepository({storage:{getItem:key=>store.get(key)??null},codec:{decodeUtf8:code=>Buffer.from(code,'base64').toString('utf8'),encodeUtf8:text=>Buffer.from(text,'utf8').toString('base64')}});
  const decoded=JSON.parse(Buffer.from(repository.exportBackup(),'base64').toString('utf8'));
  assert.deepEqual(decoded,snapshot,'Every raw child record and unknown registry/profile field survives export');
  assert.equal(JSON.stringify([...store]),before);
  assert.equal(JSON.stringify(snapshot.PR),profiles);
  for(const profile of decoded.PR.list)assert.equal(typeof decoded.data[profile.id],'string');
 });
}
test('legacy fixture contains earned history without invented separate skills',()=>{
 const snapshot=JSON.parse(fs.readFileSync(path.join(directory,'original-v1.json'),'utf8'));
 for(const raw of Object.values(snapshot.data)){
  const state=JSON.parse(raw);assert.ok(state.stars>0);assert.ok(Object.values(state.pts).some(n=>n>=5));
  assert.equal(state.learning,undefined);assert.equal(state.studyHistory,undefined);
  assert.equal(state.due['狗'],20000,'Legacy day numbers must not be reinterpreted as epoch milliseconds');
 }
});
