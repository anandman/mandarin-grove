const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}),failed=[];
 async function run(name,fn){
  if(process.env.CASE_FILTER&&!name.includes(process.env.CASE_FILTER))return;
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/api/feedback',r=>r.abort());
  try{
   await page.goto(process.env.APP_URL||'http://127.0.0.1:4200');
   await page.evaluate(()=>{PR={cur:'supported-synthetic',list:[{id:'supported-synthetic',name:'Synthetic',gr:'2',av:'🐼'}]};savePR();loadS();S.stars=77;S.opaque={preserve:'original'};save();say=()=>{};home();});
   await fn(page,context);assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>S.opaque),{preserve:'original'});console.log('PASS:',name);
  }catch(e){failed.push(name);console.error('FAIL:',name,e.stack);}finally{await context.close();}
 }
 try{
  await run('dictionary survives a disconnected cold launch and searches non-school single characters',async(p,c)=>{
   await p.waitForFunction(()=>OFFLINE_STATUS==='ready');await p.evaluate(()=>navigator.serviceWorker.ready);const before=await p.evaluate(()=>backup());
   await c.setOffline(true);await p.reload();await p.evaluate(()=>showHomeworkLookup());
   await p.locator('#lookup-bank-status[data-ready="true"]').waitFor();await p.locator('#lookup-input').fill('鑫');await p.locator('#lookup-search').click();
   await p.locator('[data-lookup-text="鑫"]').waitFor();assert.equal(await p.evaluate(()=>backup()),before);
  });
  await run('explicit app update preserves saved readings and learner data',async p=>{
   await p.waitForFunction(()=>OFFLINE_STATUS==='ready');const before=await p.evaluate(async()=>{const c=await caches.open('mandarin-grove-public-readings-v1');await c.put('/synthetic-public-text',new Response('preserved'));return backup();});
   await p.evaluate(()=>showAppUpdate('synthetic-new-version'));await p.locator('#update-now').click();await p.waitForFunction(()=>!document.querySelector('#upd')?.open);
   assert.equal(await p.evaluate(async()=>{const c=await caches.open('mandarin-grove-public-readings-v1');return (await c.match('/synthetic-public-text'))?.text();}),'preserved');assert.equal(await p.evaluate(()=>backup()),before);
  });
 }finally{await browser.close();}
 assert.deepEqual(failed,[]);
})().catch(e=>{console.error(e);process.exit(1);});
