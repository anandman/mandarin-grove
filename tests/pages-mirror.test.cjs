const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),os=require('node:os');
const {exportStatic}=require('../scripts/export-static.cjs');
// Catch root-only pathname handling by executing the actual worker against scoped cache contents.
function worker(scope='/mandarin-grove/'){
 const source=fs.readFileSync('sw.js','utf8'),version=source.match(/const VERSION='([^']+)'/)[1],handlers={},origin='https://example.github.io',banks=new Map(),network=[];
 const suffix=scope==='/'?'':encodeURIComponent(scope)+'-',prefix='mandarin-grove-shell-'+suffix;
 const manifest=JSON.stringify(['index.html','app.js','offline-assets.json']);
 banks.set(prefix+version,new Map([['offline-assets.json',manifest],['index.html','CACHED HTML'],['app.js','CURRENT SCRIPT']]));
 banks.set(prefix+'20261025-supported-70',new Map([['offline-assets.json',manifest],['app.js','OLD SCRIPT']]));
 const context=vm.createContext({URL,Request,Response,Set,caches:{has:async k=>banks.has(k),open:async k=>({match:async p=>banks.get(k)?.has(p)?new Response(banks.get(k).get(p)):undefined})},fetch:async r=>{network.push(r);return new Response('NETWORK');},self:{location:{origin,href:origin+scope+'sw.js'},registration:{scope:origin+scope},addEventListener:(n,f)=>handlers[n]=f}});vm.runInContext(source,context);
 return {version,network,request:async p=>{let promise;handlers.fetch({request:new Request(origin+p),respondWith:p=>promise=p});return promise;}};
}
test('project-site root, HTML and versioned scripts are served offline with old versions isolated',async()=>{
 const w=worker();for(const p of ['/mandarin-grove/','/mandarin-grove/index.html'])assert.equal(await(await w.request(p)).text(),'CACHED HTML');
 assert.equal(await(await w.request('/mandarin-grove/app.js?v='+w.version)).text(),'CURRENT SCRIPT');
 assert.equal(await(await w.request('/mandarin-grove/app.js?v=20261025-supported-70')).text(),'OLD SCRIPT');
 assert.equal((await w.request('/mandarin-grove/app.js?v=20261025-supported-69')).status,409);assert.equal(w.network.length,0);
});
test('worker leaves version checks, API and other project paths to the network',async()=>{
 const w=worker();for(const p of ['/mandarin-grove/version.txt?now=1','/mandarin-grove/api/feedback','/math-tutor/app.js','/api/feedback'])assert.equal(await w.request(p),undefined,p);
});
test('root deployment keeps its existing offline cache and script version behavior',async()=>{
 const w=worker('/');assert.equal(await(await w.request('/')).text(),'CACHED HTML');assert.equal(await(await w.request('/app.js?v=20261025-supported-70')).text(),'OLD SCRIPT');
});
test('maintenance removes only this deployment shell and worker, preserving readings and other apps',async()=>{
 const removed=[],unregistered=[],keys=['math-tutor-v1','mandarin-grove-public-readings-v1','mandarin-grove-shell-20261025-compact-74','mandarin-grove-shell-%2Fmandarin-grove%2F-20261025-compact-74','mandarin-grove-shell-%2Fother%2F-old'];
 const context=vm.createContext({URL,location:{href:'https://example.github.io/mandarin-grove/'},caches:{keys:async()=>keys,delete:async k=>removed.push(k)},navigator:{serviceWorker:{getRegistrations:async()=>['/math-tutor/','/','/mandarin-grove/'].map(p=>({scope:'https://example.github.io'+p,unregister:async()=>unregistered.push(p)}))}},addEventListener(){}});
 vm.runInContext(fs.readFileSync('offline.js','utf8'),context);assert.equal(typeof context.clearOfflineApp,'function');await context.clearOfflineApp();
 assert.deepEqual(removed,['mandarin-grove-shell-%2Fmandarin-grove%2F-20261025-compact-74']);assert.deepEqual(unregistered,['/mandarin-grove/']);
});
test('Pages export includes public assets and local-only feedback without private workspace files',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'grove-pages-test-')),out=path.join(temp,'site');
 try{exportStatic(path.resolve(__dirname,'..'),out,{feedback:'local'});assert.match(fs.readFileSync(path.join(out,'index.html'),'utf8'),/data-feedback="local"/);
 for(const p of ['HANDOFF.md','docs/DEVELOPMENT.md','.git/config','api/feedback.js','tests/fixtures/backups/original-v1.json'])assert.equal(fs.existsSync(path.join(out,p)),false,p);
 assert.ok(fs.existsSync(path.join(out,'vendor/cc-cedict/dictionary.json')));assert.ok(fs.existsSync(path.join(out,'.nojekyll')));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('offline audio cache admits only the finite MSU manifest and known unchecked neutral clips',async()=>{
 const code=fs.readFileSync('sw.js','utf8'),ctx=vm.createContext({URL,Request,Response,self:{location:{href:'https://example.github.io/mandarin-grove/sw.js'},addEventListener(){}}});vm.runInContext(code,ctx);
 const sha='a'.repeat(64),row={file:'audio/msu-gou3-mv3-'+sha.slice(0,12)+'.mp3',sha256:sha,speaker:'MV3',sourceId:'gou3_MV3'};
 const files=ctx.mainlandFiles({schemaVersion:1,readings:{gou3:row}});
 assert.equal(files.length,10);assert.ok(files.includes(row.file));assert.ok(files.includes('audio/'+encodeURIComponent('吗')+'.mp3'));
 for(const bad of [{...row,file:'exports/private.wav'},{...row,file:'audio/anything.mp3'},{...row,sha256:'b'.repeat(64)},{...row,sourceId:'gou4_MV3'}])assert.throws(()=>ctx.mainlandFiles({schemaVersion:1,readings:{gou3:bad}}));
 assert.throws(()=>ctx.mainlandFiles({schemaVersion:1,readings:{'../bad':row}}));assert.throws(()=>ctx.mainlandFiles({schemaVersion:1,readings:{}}));
});
test('root and Pages workers serve admitted checked and unchecked audio from their own offline cache',async()=>{
 for(const scope of ['/','/mandarin-grove/']){
  const code=fs.readFileSync('sw.js','utf8'),v=code.match(/const VERSION='([^']+)'/)[1],handlers={},network=[],sha='a'.repeat(64),file='audio/msu-gou3-mv3-'+sha.slice(0,12)+'.mp3',neutral='audio/'+encodeURIComponent('吗')+'.mp3';
  const bank=new Map([['offline-assets.json',JSON.stringify(['index.html','audio-sources/mainland.json'])],['audio-sources/mainland.json',JSON.stringify({schemaVersion:1,readings:{gou3:{file,sha256:sha,speaker:'MV3',sourceId:'gou3_MV3'}}})],[file,'CHECKED BYTES'],[neutral,'UNCHECKED BYTES']]);
  const prefix='mandarin-grove-shell-'+(scope==='/'?'':encodeURIComponent(scope)+'-');
  const ctx=vm.createContext({URL,Request,Response,Set,caches:{open:async name=>{assert.equal(name,prefix+v);return{match:async p=>bank.has(p)?new Response(bank.get(p)):undefined};}},fetch:async r=>{network.push(r);return new Response('NETWORK');},self:{location:{href:'https://example.github.io'+scope+'sw.js'},addEventListener:(n,f)=>handlers[n]=f}});vm.runInContext(code,ctx);
  for(const [relative,body]of [[file,'CHECKED BYTES'],[neutral,'UNCHECKED BYTES']]){let response;handlers.fetch({request:new Request('https://example.github.io'+scope+relative),respondWith:p=>response=p});assert.equal(await(await response).text(),body);}
  assert.equal(network.length,0);
 }
});
