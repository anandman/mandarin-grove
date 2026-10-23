const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let backup,state;try{backup=require('../core/backup.js');state=require('../core/state.js');}catch{}
const codec={decodeUtf8:code=>new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(code,'base64')),encodeUtf8:text=>Buffer.from(text,'utf8').toString('base64')};
const encode=o=>codec.encodeUtf8(JSON.stringify(o)),fixture=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/backups',name),'utf8'));
for(const name of ['original-v1.json','grove-v1.json'])test('detached raw backup round trip: '+name,()=>{
 assert.equal(typeof backup?.decodeBackup,'function');const input=fixture(name),before=JSON.stringify(input),decoded=backup.decodeBackup(encode(input),codec);
 assert.deepEqual(decoded.registry,input.PR);assert.deepEqual(decoded.rawProfiles,input.data);
 decoded.registry.list[0].name='detached';assert.equal(JSON.stringify(input),before);
 assert.deepEqual(JSON.parse(codec.decodeUtf8(backup.encodeBackup(backup.decodeBackup(encode(input),codec),codec))),input);
});
test('empty registry and opaque envelope extensions preserve exact Unicode/null/array fields',()=>{
 const input={PR:{cur:null,list:[],future:{a:null}},data:{},future:['绿','nǚ',0,false]};
 assert.deepEqual(JSON.parse(codec.decodeUtf8(backup.encodeBackup(backup.decodeBackup(encode(input),codec),codec))),input);
});
test('invalid complete envelopes and every inactive snapshot reject without mutating source',()=>{
 const valid=fixture('original-v1.json');
 const cases=[null,[],1,{}, {PR:[],data:{}}, {...valid,PR:{...valid.PR,list:{}}}, {...valid,PR:{...valid.PR,cur:'absent'}}, {...valid,PR:{...valid.PR,list:[null]}}, {...valid,PR:{...valid.PR,list:[valid.PR.list[0],valid.PR.list[0]]}}, {...valid,data:{...valid.data,extra:'{}'}}];
 for(const value of [undefined,null,'',{},'null','[]','true','{"cfg":[]}','{"cfg":{"past":{}}}','{"pts":[]}','{"learning":{"chars":[]}}','{"groveRewards":{"owned":{}}}']){
  const v=structuredClone(valid);if(value===undefined)delete v.data['synthetic-b'];else v.data['synthetic-b']=value;cases.push(v);
 }
 for(const value of cases){const before=JSON.stringify(value);assert.throws(()=>backup.decodeBackup(encode(value),codec),Error,JSON.stringify(value)?.slice(0,80));assert.equal(JSON.stringify(value),before);}
 for(const code of ['!bad base64!','e30','bnVsbA==','/w=='])assert.throws(()=>backup.decodeBackup(code,codec),Error,code);
});
test('prototype-looking extension keys are retained as data without pollution',()=>{
 const value=JSON.parse('{"PR":{"cur":"__proto__","list":[{"id":"__proto__","name":"Synthetic"}]},"data":{"__proto__":"{\\"cfg\\":{},\\"future\\":{\\"__proto__\\":{\\"polluted\\":true}}}"},"constructor":{"keep":true}}');
 const decoded=backup.decodeBackup(encode(value),codec);assert.equal({}.polluted,undefined);
 assert.deepEqual(JSON.parse(codec.decodeUtf8(backup.encodeBackup(decoded,codec))),value);
});
test('profile preparation keeps legacy cfg, opaque fields and no invented skills; migrations are detached',()=>{
 const raw=fixture('original-v1.json').data['synthetic-a'];
 const result=state.prepareProfile(raw,{now:123,migrate:(s,now)=>{s.migrationTime=now;return s;}});
 const expected=JSON.parse(raw);assert.deepEqual(result.cfg,expected.cfg);assert.deepEqual(result.pts,expected.pts);assert.equal(result.migrationTime,123);assert.equal(result.learning,undefined);assert.equal(result.studyHistory,undefined);
 assert.equal(raw,fixture('original-v1.json').data['synthetic-a']);
 assert.deepEqual(state.emptyProfile(),{stars:0,streak:0,last:'',pts:{},box:{},due:{},cfg:{test:'',quiz:''}});
 assert.throws(()=>state.prepareProfile('{bad'),Error);
});
test('recognized resumable rounds require complete runnable shapes in every imported child',()=>{
 const valid=fixture('grove-v1.json');
 const invalid=[{studyRounds:{'2':{practice:{}}}},{cram:{}},{rs:{}},{cramDict:{}},{studyRounds:{'2':{practice:{id:'x',kind:'practice',q:[['listen','狗']],cursor:0,results:{},config:{}}}}},{cram:{q:[['listen','狗']],i:0}},{cramDict:{q:['狗'],i:0}}];
 for(const id of Object.keys(valid.data))for(const cfg of invalid){const value=structuredClone(valid),child=JSON.parse(value.data[id]);Object.assign(child.cfg,cfg);value.data[id]=JSON.stringify(child);const before=JSON.stringify(value);assert.throws(()=>backup.decodeBackup(encode(value),codec),Error,id+' '+JSON.stringify(cfg));assert.equal(JSON.stringify(value),before);}
 const historical=structuredClone(valid),child=JSON.parse(historical.data['synthetic-a']);child.studyHistory.push({futureHistoricalRecord:{keep:true},results:{}});historical.data['synthetic-a']=JSON.stringify(child);assert.equal(backup.decodeBackup(encode(historical),codec).rawProfiles['synthetic-a'],historical.data['synthetic-a'],'Sparse unknown historical rows remain opaque and unchanged');
});
