// Real cached-app upgrades, with a deliberately slow download and a failed install/retry.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {exportStatic}=require('../scripts/export-static.cjs');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
const version=fs.readFileSync(path.join(root,'version.txt'),'utf8').trim();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'grove-update-browser-')),sites={};
const engines=(process.env.UPDATE_BROWSERS||'chromium').split(',');
let server;
async function run(){
 sites.current=exportStatic(root,path.join(temp,'current'));
 for(const name of ['legacy','intermediate','slow','retry']){sites[name]=path.join(temp,name);fs.cpSync(sites.current,sites[name],{recursive:true});}
 for(const file of ['index.html','version.txt','sw.js','offline.js','version-check.js'])fs.writeFileSync(path.join(sites.legacy,file),execFileSync('git',['show','487b737339eadd8464fe8ac3f85c559e184894f5:'+file],{cwd:root}));
 const intermediateVersion='20261031-update-test-805',nextVersion='20261031-update-test-81',retryVersion='20261031-update-test-82';
 for(const [name,release]of [['intermediate',intermediateVersion],['slow',nextVersion],['retry',retryVersion]])for(const file of ['index.html','version.txt','sw.js','version-check.js']){
  const p=path.join(sites[name],file);fs.writeFileSync(p,fs.readFileSync(p,'utf8').replaceAll(version,release));
 }
 let fixture='legacy',slow=false,fail=false,delayed=0,networkDown=false;
 server=http.createServer((req,res)=>{
  if(networkDown){req.socket.destroy();return;}
  const url=new URL(req.url,'http://localhost'),relative=decodeURIComponent(url.pathname).replace(/^\/mandarin-grove\//,'/').replace(/^\//,'')||'index.html',site=sites[fixture],file=path.resolve(site,relative);
  if(!file.startsWith(site+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  const installAsset=relative==='theme.css'&&!url.searchParams.has('v');
  const send=()=>{
   if(res.destroyed)return;
   if(fail&&installAsset){res.writeHead(503);res.end('Synthetic unavailable update asset');return;}
   const type={'.js':'text/javascript','.json':'application/json','.html':'text/html','.css':'text/css','.txt':'text/plain','.mp3':'audio/mpeg'}[path.extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
  };
  if(slow&&installAsset){delayed++;setTimeout(send,12000);}else send();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 for(const engine of engines){
  const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.CHROMIUM_PATH}:{})});
  try{for(const scope of (process.env.UPDATE_SCOPES||'/,/mandarin-grove/').split(',')){
   fixture='legacy';slow=false;fail=false;delayed=0;networkDown=false;
   const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(origin+scope);await page.waitForFunction(()=>OFFLINE_STATUS==='ready'&&navigator.serviceWorker.controller,{},{timeout:60000});
    assert.equal(await page.evaluate(()=>VER),'20261030-feedback-78','Reproduce the actual old release identity bug');
    await page.evaluate(async()=>{
     PR={cur:'update',list:[{id:'update',name:'Learner',gr:'2',av:'🐼'}]};savePR();S=blank();S.stars=149;S.pts={学:7};S.cfg.set=['学'];S.cfg.rs={q:[['listen','学'],['trace','学']],i:1,p:['学'],t:''};S.future={opaque:'preserved'};localStorage.setItem('zh_p_update',JSON.stringify(S));loadS();home();
     const readings=await caches.open('mandarin-grove-public-readings-v1');await readings.put('/synthetic-reading',new Response('saved reading'));
     const sibling=await caches.open('math-tutor-v1');await sibling.put('/synthetic-other-app',new Response('other app'));
    });
    const saved=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
    async function unchanged(){
     assert.equal(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage)))),saved,'Every saved profile/progress/preference byte survives');
     assert.equal(await page.evaluate(async()=>await(await(await caches.open('mandarin-grove-public-readings-v1')).match('/synthetic-reading')).text()),'saved reading');
     assert.equal(await page.evaluate(async()=>await(await(await caches.open('math-tutor-v1')).match('/synthetic-other-app')).text()),'other app');
    }
    async function notice(){await page.evaluate(()=>chkVer());await page.locator('#upd[open]').waitFor({timeout:5000});}
    async function loaded(expected){await page.waitForFunction(expected=>typeof VER!=='undefined'&&VER===expected,expected,{timeout:60000});await page.evaluate(()=>chkVer());assert.equal(await page.locator('#upd[open]').count(),0,'Updated release must not prompt again');await unchanged();}
    fixture='current';await notice();await Promise.all([page.waitForNavigation({timeout:60000}),page.locator('#update-now').click()]);await loaded(version);
    await page.evaluate(()=>grown());assert.match(await page.locator('#gov').innerText(),new RegExp('App version: '+version));await page.keyboard.press('Escape');
    console.log('PASS',engine,scope,'actual legacy79 update reaches current release once, with version shown in Grown-ups');
    await page.waitForFunction(()=>OFFLINE_STATUS==='ready'&&navigator.serviceWorker.controller,{},{timeout:60000});
    fixture='intermediate';await page.evaluate(async()=>{window.testUpdateRegistration=await navigator.serviceWorker.getRegistration();await testUpdateRegistration.update();});
    await page.waitForFunction(()=>window.testUpdateRegistration.waiting?.state==='installed',{},{timeout:60000});
    const waitingVersion=await page.evaluate(()=>offlineWorkerVersion(testUpdateRegistration.waiting));
    assert.equal(waitingVersion,intermediateVersion);
    fixture='slow';slow=true;await notice();const oldURL=page.url();await page.locator('#update-now').click();
    // This exceeds the former ten-second shortcut while a known asset request is still held.
    await page.waitForTimeout(10500);assert.ok(delayed>0);assert.equal(page.url(),oldURL);assert.equal(await page.evaluate(()=>VER),version);assert.ok(await page.locator('#update-now').isDisabled());
    await page.waitForFunction(expected=>VER===expected,nextVersion,{timeout:60000});slow=false;await loaded(nextVersion);
    console.log('PASS',engine,scope,'skips intermediate waiting release; 12-second requested install waits for new controller, reloads once and stops prompting');
    fixture='retry';fail=true;await page.evaluate(()=>{window.say=()=>{};showWordPractice([ALL.find(c=>c.c==='学')]);});await page.waitForFunction(()=>!document.getElementById('word-check').disabled);await page.locator('#word-input').fill('学校');await notice();
    const failedURL=page.url();await page.locator('#update-now').click();await page.locator('#update-status:not([hidden])').waitFor({timeout:30000});
    assert.equal(page.url(),failedURL);assert.equal(await page.evaluate(()=>VER),nextVersion);assert.equal(await page.locator('#word-input').inputValue(),'学校');assert.ok(await page.locator('#update-now').isEnabled());assert.ok(await page.locator('#update-later').isEnabled());await unchanged();
    fail=false;await Promise.all([page.waitForNavigation({timeout:60000}),page.locator('#update-now').click()]);await loaded(retryVersion);
    await page.waitForFunction(()=>OFFLINE_STATUS==='ready'&&navigator.serviceWorker.controller,{},{timeout:60000});
    console.log('OFFLINE ready',engine,scope,JSON.stringify(await page.evaluate(async()=>({worker:navigator.serviceWorker.controller.scriptURL,registration:(await navigator.serviceWorker.getRegistration()).active.state,caches:await caches.keys()}))));
    // WebKit's emulated offline mode can fail navigation before consulting its worker.
    // Cut the actual origin connection there; cached requests must still work.
    if(engine==='webkit')networkDown=true;else await context.setOffline(true);
    assert.equal(await page.evaluate(async()=>{try{await fetch('version.txt?offline-proof=1',{cache:'no-store'});return false;}catch{return true;}}),true,'The origin must really be unreachable');
    await page.reload();await loaded(retryVersion);assert.deepEqual(errors,[]);
    console.log('PASS',engine,scope,'failed install keeps unfinished answer, retry succeeds, current app relaunches offline, state/readings/sibling cache unchanged');
   }finally{await context.close();}
  }}finally{await browser.close();}
 }
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(resolve=>server.close(resolve));console.log('Preserved generated upgrade fixtures:',temp);});
