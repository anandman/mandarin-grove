// Protect explicit updating, accessible controls and saved/in-progress work during an update notice.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:740}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let release='same';
  await page.route('**/version.txt?*',async route=>{
   if(release==='offline')return route.abort();
   if(release==='same')return route.continue();
   return route.fulfill({body:release});
  });
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4181');
  await page.evaluate(()=>{PR={cur:'update',list:[{id:'update',name:'Learner',gr:'2',av:'🐼'}]};savePR();S=blank();S.stars=149;S.pts={学:7};S.cfg.set=['学'];S.cfg.rs={q:[['listen','学'],['trace','学']],i:1,p:['学'],t:''};localStorage.setItem('zh_p_update',JSON.stringify(S));loadS();window.say=()=>{};home();});
  const saved=await page.evaluate(()=>localStorage.getItem('zh_p_update'));
  await page.evaluate(()=>chkVer());assert.equal(await page.locator('dialog[open]').count(),0,'Current release should not interrupt');
  release='offline';await page.evaluate(()=>chkVer());assert.equal(await page.locator('dialog[open]').count(),0,'Offline checks should not interrupt');
  await page.evaluate(()=>showWordPractice([ALL.find(c=>c.c==='学')]));await page.waitForFunction(()=>!document.getElementById('word-check').disabled);await page.locator('#word-input').fill('学校');
  release='future-update-test';await page.evaluate(()=>chkVer());
  const dialog=page.getByRole('dialog',{name:'Update Mandarin Grove'});
  await dialog.waitFor({state:'visible',timeout:3000});
  const primary=dialog.getByRole('button',{name:'Update now',exact:true}),later=dialog.getByRole('button',{name:'Keep practicing',exact:true});
  assert.ok(await primary.isVisible());assert.ok(await primary.evaluate(e=>document.activeElement===e),'Keyboard starts on explicit update control');
  await page.keyboard.press('Tab');assert.ok(await later.evaluate(e=>document.activeElement===e));await page.keyboard.press('Tab');assert.ok(await primary.evaluate(e=>document.activeElement===e),'Focus remains inside the update dialog');
  for(const [device,width,height]of [['phone',390,740],['small-phone',320,568],['ipad',820,1060],['desktop',1180,740]])for(const mode of ['light','dark']){
   await page.setViewportSize({width,height});await page.evaluate(mode=>setAppearance(mode),mode);
   const bounds=await dialog.boundingBox(),button=await primary.boundingBox();assert.ok(bounds.width>=width-2&&bounds.height>=height-2,'Update notice fills '+device);assert.ok(button.height>=56&&button.width>=220&&button.y+button.height<=height,'Large Update now button is visible on '+device);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(device==='phone')await page.screenshot({path:`/tmp/grove-update-${mode}.png`});
  }
  await later.click();assert.equal(await dialog.count(),0);assert.equal(await page.locator('#word-input').inputValue(),'学校','Deferral keeps unsubmitted input');
  await page.evaluate(()=>chkVer());assert.equal(await dialog.count(),0,'Same release does not immediately nag again');
  assert.equal(await page.evaluate(()=>localStorage.getItem('zh_p_update')),saved,'Update checks and deferral cannot rewrite saved progress');
  release='newer-update-test';await page.evaluate(()=>chkVer());await dialog.waitFor({state:'visible'});await page.keyboard.press('Escape');assert.equal(await dialog.count(),0,'Escape safely defers');
  release='third-update-test';await page.evaluate(()=>chkVer());await dialog.waitFor({state:'visible'});
  release='same';await Promise.all([page.waitForNavigation(),primary.press('Enter')]);
  assert.match(page.url(),/\?v=\d+$/,'Keyboard activation explicitly loads a fresh app URL');
  assert.equal(await page.evaluate(()=>localStorage.getItem('zh_p_update')),saved,'Updating preserves profiles, stars, character counts and saved question cursor exactly');
  assert.ok(await page.getByRole('button',{name:/Keep going/}).isVisible(),'Saved practice is resumable after update');
  await page.evaluate(()=>resume());assert.match(await page.locator('#app').innerText(),/2 \/ 2/,'Resumes the saved next question');
  assert.deepEqual(errors,[]);
  console.log('PASS: full-screen update controls, keyboard/focus, deferral, offline/same-release behavior, unsubmitted input and exact saved progress/resume on phone/tablet/desktop in both themes.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
