const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const source='online-content.js';
test('the optional online library has a portable client without child-state dependencies',()=>{
 assert.ok(fs.existsSync(source),'online content client exists');
 const text=fs.readFileSync(source,'utf8');assert.ok(!/\b(?:localStorage|PR|S|savePR)\b/.test(text),'public readings do not access learner state');
});
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const sentence={id:17,text:'我去学校。',lang:'cmn',script:'Hans',license:'CC BY 2.0 FR',owner:'writer',is_unapproved:false,translations:[{id:18,text:'I go to school.',lang:'eng',license:'CC BY 2.0 FR',owner:'translator',is_unapproved:false,is_direct:true}]};
const normalized=s=>JSON.stringify([s.id,s.text,s.lang,s.script,s.license,s.owner,s.is_unapproved,...s.translations.filter(t=>t.id===18).map(t=>[t.id,t.text,t.lang,t.license,t.owner,t.is_unapproved,t.is_direct])]);
const story='# 测试\n\n##\n我在看书。\n\n##\n* License: [CC-BY]\n* Text: A Writer\n* Illustration: An Artist\n* Translation: A Translator\n* Language: zh\n';
function catalog(){return {schemaVersion:1,id:'grove-online-reading',version:'test-1',items:[{id:'sentence-17',kind:'sentence',title:'Going to school',sourceId:'tatoeba',remoteId:17,translationId:18,sha256:hash(normalized(sentence)),license:'CC-BY-2.0-FR',authors:['writer','translator'],sourceUrl:'https://tatoeba.org/en/sentences/show/17',words:['学校'],reviewStatus:'pilot-selected-teaching-pending'},{id:'story-0001',kind:'story',title:'测试',sourceId:'global-asp',path:'zh/0001_测试.md',revision:'a'.repeat(40),sha256:hash(story),license:'CC-BY-3.0',authors:['A Writer','A Translator'],sourceUrl:'https://global-asp.github.io/storybooks-chinese/stories/zh/0001/',words:['看书'],reviewStatus:'pilot-selected-teaching-pending'}]};}
function library(options={},c=catalog()){assert.ok(fs.existsSync(source),'online content client exists');return require('../online-content.js').createLibrary(c,options);}
function cacheStore(){const data=new Map(),key=x=>x.url||String(x);return {data,has:async()=>data.size>0,open:async()=>({keys:async()=>[...data.keys()].map(url=>new Request(url)),match:async k=>data.has(key(k))?new Response(data.get(key(k))):undefined,put:async(k,res)=>data.set(key(k),await res.text()),delete:async k=>data.delete(key(k))})};}
test('construction/listing never fetches; only a selected id produces a fixed text API request',async()=>{
 const calls=[],lib=library({fetcher:async(u,o)=>{calls.push([u,o]);return Response.json({data:sentence});}});
 assert.equal(lib.list().length,2);assert.equal(calls.length,0);await assert.rejects(()=>lib.read('unknown'));assert.equal(calls.length,0);
 const r=await lib.read('sentence-17');assert.deepEqual(r.paragraphs,['我去学校。']);assert.deepEqual(r.translation,['I go to school.']);assert.equal(r.saved,false);
 assert.equal(new URL(calls[0][0]).origin,'https://api.tatoeba.org');assert.equal(new URL(calls[0][0]).pathname,'/v1/sentences/17');
 assert.equal(calls[0][1].credentials,'omit');assert.equal(calls[0][1].referrerPolicy,'no-referrer');assert.equal(calls[0][1].redirect,'error');
});
test('dynamic edits, approvals, owner, script, license and chosen translation are integrity checked',async()=>{
 for(const mutate of [s=>s.text='改了。',s=>s.is_unapproved=true,s=>s.owner=null,s=>s.script='Hant',s=>s.license='PROBLEM',s=>s.translations[0].text='changed',s=>s.translations[0].license='PROBLEM',s=>s.translations[0].is_direct=false,s=>s.translations=[],s=>s.id=99]){
  const changed=structuredClone(sentence);mutate(changed);await assert.rejects(()=>library({fetcher:async()=>Response.json({data:changed})}).read('sentence-17'));
 }
 const extra=structuredClone(sentence);extra.translations.push({id:999,text:'unselected'});
 assert.deepEqual((await library({fetcher:async()=>Response.json({data:extra})}).read('sentence-17')).translation,['I go to school.']);
});
test('story uses immutable HTTPS source and only plain paragraphs, with exact bytes verified',async()=>{
 let url;const r=await library({fetcher:async u=>{url=u;return new Response(story);}}).read('story-0001');assert.match(url,/global-asp\/global-asp\/a{40}\/zh\//);assert.deepEqual(r.paragraphs,['我在看书。']);assert.deepEqual(r.translation,[]);
 await assert.rejects(()=>library({fetcher:async()=>new Response(story+'altered')}).read('story-0001'));
});
test('catalog rejects unapproved providers, paths, licenses and ambiguous identities before any fetch',()=>{
 for(const mutate of [c=>c.items[0].remoteId=-1,c=>c.items[0].sourceId='evil',c=>c.items[1].path='../secrets',c=>c.items[1].revision='master',c=>c.items[0].license='PROBLEM',c=>c.items.push(c.items[0]),c=>c.items[1].sourceUrl='javascript:alert(1)',c=>c.items[0].sha256='none']){const c=catalog();mutate(c);assert.throws(()=>library({},c));}
});
test('network errors, malformed/oversized responses, timeout and abort stay failures without cache writes',async()=>{
 for(const fetcher of [async()=>new Response('no',{status:429}),async()=>new Response('<html>bad</html>'),async()=>new Response('a'.repeat(65537))])await assert.rejects(()=>library({fetcher}).read('sentence-17'));
 await assert.rejects(()=>library({fetcher:async()=>new Promise(()=>{}),timeoutMs:15}).read('sentence-17'),/timeout/);
 const controller=new AbortController(),pending=library({fetcher:async()=>new Promise(()=>{})}).read('sentence-17',{signal:controller.signal});controller.abort();await assert.rejects(()=>pending,/cancel/);
 let cancelled=false;const body=new ReadableStream({pull(c){c.enqueue(new Uint8Array(32769));},cancel(){cancelled=true;}});
 await assert.rejects(()=>library({fetcher:async()=>new Response(body)}).read('sentence-17'),/large/);assert.equal(cancelled,true);
});
test('only explicit save writes a verified public copy, usable offline after reconstruction',async()=>{
 const caches=cacheStore();let requests=0;const lib=library({cacheStorage:caches,fetcher:async()=>{requests++;return Response.json({data:sentence});}});
 const r=await lib.read('sentence-17');assert.equal(caches.data.size,0);assert.equal(await lib.isSaved('sentence-17'),false);await lib.save('sentence-17',r);assert.equal(caches.data.size,1);
 const offline=library({cacheStorage:caches,fetcher:async()=>{throw Error('offline');}});assert.equal((await offline.read('sentence-17')).saved,true);assert.equal(requests,1);assert.equal(await offline.isSaved('sentence-17'),true);
 await offline.remove('sentence-17');assert.equal(caches.data.size,0);await assert.rejects(()=>offline.read('sentence-17'));
});
test('corrupt cache is not trusted; failed saves never replace a previous good public copy',async()=>{
 const caches=cacheStore(),lib=library({cacheStorage:caches,fetcher:async()=>Response.json({data:sentence})});const r=await lib.read('sentence-17');await lib.save('sentence-17',r);const before=[...caches.data];
 await assert.rejects(()=>lib.save('sentence-17',{raw:'<script>bad</script>'}));assert.deepEqual([...caches.data],before);
 const key=[...caches.data.keys()][0];caches.data.set(key,'broken');assert.equal(await lib.isSaved('sentence-17'),false);assert.equal((await lib.read('sentence-17')).saved,false);
 const quota=library({cacheStorage:{has:async()=>false,open:async()=>({keys:async()=>[],put:async()=>{throw Error('quota');}})},fetcher:async()=>Response.json({data:sentence})});await assert.rejects(()=>quota.save('sentence-17',r),/quota/);
 await assert.rejects(()=>library({cacheStorage:null}).save('sentence-17',r),/storage/);
});
test('checked-in pilot catalogue is bounded, sourced, independent of any learner and has no embedded reading bodies',()=>{
 assert.ok(fs.existsSync('content/online-library.js'),'selected manifest exists');const c=require('../content/online-library.js');assert.equal(c.items.length,9);assert.equal(library({},c).list().filter(x=>x.kind==='story').length,3);
 for(const i of c.items){assert.ok(i.authors.length);assert.equal(i.reviewStatus,'pilot-selected-teaching-pending');assert.ok(!i.paragraphs&&!i.text&&!i.translation);}
});
test('unselected translations and arbitrary provider fields never enter the public offline cache',async()=>{
 const s=structuredClone(sentence);s.providerMetadata={unselected:'not licensed'};s.translations[0].extra='unverified';s.translations.push({id:999,text:'unselected private or adult content',license:'NO REUSE',is_unapproved:true});
 const caches=cacheStore(),lib=library({cacheStorage:caches,fetcher:async()=>Response.json({data:s,unverifiedEnvelope:'discard'})}),result=await lib.read('sentence-17');await lib.save('sentence-17',result);
 const stored=[...caches.data.values()][0];assert.ok(!stored.includes('unselected'));assert.ok(!stored.includes('unverified'));assert.ok(!stored.includes('NO REUSE'));
 const decoded=JSON.parse(stored);assert.deepEqual(Object.keys(decoded),['data']);assert.equal(decoded.data.translations.length,1);assert.equal(decoded.data.translations[0].id,18);assert.equal(decoded.data.providerMetadata,undefined);
 const offline=library({cacheStorage:caches,fetcher:async()=>{throw Error('offline');}});assert.deepEqual((await offline.read('sentence-17')).translation,['I go to school.']);
});
