const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:740}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4173');
  const initial=await page.evaluate(async ()=>{
   PR={cur:'paths',list:[{id:'paths',name:'Learner',gr:'2',av:'🐳'}]};(await savePR());S=blank();S.stars=149;S.cfg.set=['狗','猫'];S.cfg.quiz=QU('2')[0][1];S.cfg.cramUnits={'2':[1,3]};localStorage.setItem('zh_p_paths',JSON.stringify(S));(await loadS());window.say=()=>{};(await home());return (await backup());
  });
  assert.match(await page.locator('.grove-daily').innerText(),/Practice/);
  await page.evaluate(async ()=>(await dictStart(CARDS.map(c=>c.c).join(''))));
  assert.ok(await page.getByRole('heading',{name:'Listen & Write',exact:true}).isVisible());
  assert.ok(await page.locator('#dc').isVisible());assert.ok(await page.locator('#tiles').isVisible());
  const pool=await page.evaluate(()=>DQ.q.map(c=>c.c).sort());assert.deepEqual(pool,['狗','猫'].sort(),'Direct path uses active practice characters, not the school quiz or review selection');
  assert.equal(await page.evaluate(async ()=>(await backup())),initial,'Opening the path preserves saved progress and selections');
  await page.evaluate(async ()=>(await home()));await page.evaluate(async ()=>(await showCram()));
  assert.ok(await page.getByRole('heading',{name:'Unit review',exact:true}).isVisible());
  assert.deepEqual(await page.evaluate(()=>[...cramSelection[GR()]]),[1,3]);
  await page.locator('.compact-help').first().locator('summary').click();
  assert.match(await page.locator('.compact-help').first().innerText(),/random/i);
  assert.match(await page.locator('.compact-help').first().innerText(),/same.*progress/i);
  await page.locator('[data-cram-mode="mixed"]').click();
  const queue=await page.evaluate(()=>SESS.q.map(([m,c])=>[m,c.c]));
  assert.equal(queue.length,30);for(const mode of ['trace','listen','flip','memory','dictation'])assert.equal(queue.filter(([m])=>m===mode).length,6);
  await page.reload();await page.evaluate(async ()=>{window.say=()=>{};(await home())});
  await page.getByRole('button',{name:'Continue earlier unit review',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>SESS.q.map(([m,c])=>[m,c.c])),queue,'Existing review storage and resume keys remain compatible');
  for(const grade of ['K','1','2','4','5']){
   await page.evaluate(async grade=>{(await home());PR.list[0].gr=grade;(await savePR());(await loadS());window.say=()=>{};(await home())},grade);
   assert.equal(await page.locator('.study-home-entries button').count(),2);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: retained Listen & Write activity uses active characters; consolidated Home with compatible old Unit review, stored unit choices, balanced review queue and reload/resume are preserved.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
