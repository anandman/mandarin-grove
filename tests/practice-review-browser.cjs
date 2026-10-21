const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:740}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4173');
  const initial=await page.evaluate(()=>{
   PR={cur:'paths',list:[{id:'paths',name:'Learner',gr:'2',av:'🐳'}]};savePR();S=blank();S.stars=149;S.cfg.set=['狗','猫'];S.cfg.quiz=QU('2')[0][1];S.cfg.cramUnits={'2':[1,3]};localStorage.setItem('zh_p_paths',JSON.stringify(S));loadS();window.say=()=>{};home();return backup();
  });
  assert.match(await page.locator('.grove-daily').innerText(),/Daily practice/);
  const path=page.getByRole('button',{name:/Listen & Write.*Character \+ pinyin/});await path.click();
  assert.ok(await page.getByRole('heading',{name:'Listen & Write',exact:true}).isVisible());
  assert.ok(await page.locator('#dc').isVisible());assert.ok(await page.locator('#tiles').isVisible());
  const pool=await page.evaluate(()=>DQ.q.map(c=>c.c).sort());assert.deepEqual(pool,['狗','猫'].sort(),'Direct path uses active practice characters, not the school quiz or review selection');
  assert.equal(await page.evaluate(()=>backup()),initial,'Opening the path preserves saved progress and selections');
  await page.evaluate(()=>home());await page.getByRole('button',{name:/Unit review/}).click();
  assert.ok(await page.getByRole('heading',{name:'Unit review',exact:true}).isVisible());
  assert.deepEqual(await page.evaluate(()=>[...cramSelection[GR()]]),[1,3]);
  await page.locator('.compact-help').first().locator('summary').click();
  assert.match(await page.locator('.compact-help').first().innerText(),/random/i);
  assert.match(await page.locator('.compact-help').first().innerText(),/same.*progress/i);
  await page.locator('[data-cram-mode="mixed"]').click();
  const queue=await page.evaluate(()=>SESS.q.map(([m,c])=>[m,c.c]));
  assert.equal(queue.length,30);for(const mode of ['trace','listen','flip','memory','dictation'])assert.equal(queue.filter(([m])=>m===mode).length,6);
  await page.reload();await page.evaluate(()=>{window.say=()=>{};home()});
  await page.getByRole('button',{name:'Resume unit review',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>SESS.q.map(([m,c])=>[m,c.c])),queue,'Existing review storage and resume keys remain compatible');
  for(const grade of ['K','1','2','4','5']){
   await page.evaluate(grade=>{home();PR.list[0].gr=grade;savePR();loadS();window.say=()=>{};home()},grade);
   assert.equal(await page.locator('.grove-paths button').count(),Number(grade)>=2?5:4);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: direct Grade2+ Listen & Write path uses active characters; Daily practice / Unit review copy, stored unit choices, balanced review queue and reload/resume are preserved.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
