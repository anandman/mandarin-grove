const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4173');
  await page.evaluate(()=>{PR={cur:'compact',list:[{id:'compact',name:'Learner',gr:'4',av:'🐳'}]};savePR();S=blank();S.stars=149;S.pts={祖:5,止:5};S.cfg.set=[...QU('4')[0][1]];S.cfg.quiz=QU('4')[0][1];localStorage.setItem('zh_p_compact',JSON.stringify(S));loadS();pinGroveGoal(S,'project:reading-nook');save();window.say=()=>{};home();});
  const fits=async(locator,label)=>{assert.ok(await locator.isVisible(),label+' must be visible');const r=await locator.boundingBox();assert.ok(r.y>=0&&r.y+r.height<=page.viewportSize().height,label+' must fit the first screen ('+Math.round(r.y+r.height)+'px)');};
  for(const [device,width,height]of [['phone',390,740],['ipad',820,1060],['ipad-landscape',1180,740]]){
   await page.setViewportSize({width,height});
   for(const mode of ['light','dark']){
    await page.evaluate(mode=>{setAppearance(mode);home()},mode);await page.evaluate(()=>new Promise(requestAnimationFrame));
    await fits(page.locator('.grove-daily'),device+' daily practice');
    const core=page.locator('.study-home-entries button,.study-help-entry');
    assert.equal(await core.count(),3,'Two learning entries plus homework Help');
    for(let i=0;i<await core.count();i++){await fits(core.nth(i),device+' activity '+i);const r=await core.nth(i).boundingBox();assert.ok(r.height>=44&&r.width>=44);}
    await fits(page.getByRole('button',{name:'My progress',exact:true}),device+' progress');
    assert.ok(await page.locator('.grove-hero-art svg').isVisible(),'Keep the Grove artwork');
    const homeArt=await page.locator('.grove-hero-art svg').boundingBox();
    assert.ok(homeArt.width>=(width<680?150:220),'The Home grove should be large enough to see');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`/tmp/grove-compact-${device}-home-${mode}.png`});
    await page.evaluate(()=>showGroveRewards());
    const preview=await page.locator('.grove-reward-scene svg').boundingBox();
    assert.ok(preview.height>=(width<680?175:210),'Give the grove preview more room than a thumbnail');
    if(width<680)assert.ok(preview.width>=width-40,'Use the phone width for the grove preview');
    await fits(page.getByRole('tab',{name:'Build',exact:true}),device+' rewards categories');
    const pieces=page.locator('[data-project] button[data-grove-control^="build-"]');
    for(let i=0;i<await pieces.count();i++)await fits(pieces.nth(i),device+' project '+i);
    await page.getByRole('tab',{name:'Ground',exact:true}).click();
    const ground=page.getByRole('tabpanel',{name:'Ground',exact:true});
    assert.equal(await ground.locator('[data-reward]:visible').count(),4);
    if(width<680)for(const card of await ground.locator('[data-reward]').all()){
     assert.ok((await card.boundingBox()).height<=112,'Keep phone decoration tiles compact');
     for(const button of await card.locator('button').all())assert.ok((await button.boundingBox()).height>=44,'Keep purchase and goal buttons easy to tap');
    }
    const about=ground.getByLabel('About Wildflowers',{exact:true});
    await about.focus();await page.keyboard.press('Enter');
    assert.ok(await ground.locator('[data-reward="flowers"] details>small').isVisible(),'Descriptions remain available on demand');
    await page.keyboard.press('Space');
    assert.equal(await ground.locator('[data-reward="flowers"] details').getAttribute('open'),null);
    await fits(ground.locator('[data-reward="pond"] .btn'),device+' fourth decoration');
    assert.equal(await page.locator('[data-project]:visible').count(),0,'One reward category at a time');
    await page.screenshot({path:`/tmp/grove-compact-${device}-rewards-${mode}.png`});
    await page.getByRole('tab',{name:'Ground',exact:true}).focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab',{name:'Reading spot',exact:true}).getAttribute('aria-selected'),'true');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.evaluate(()=>{S.cfg.groveRewardTab='build';showCram()});
    await fits(page.locator('[data-cram-mode="mixed"]'),device+' mixed review start');
    await fits(page.locator('.cram-actions'),device+' review selection controls');
    await page.locator('[data-unit="2"]').check();await page.locator('[data-unit="7"]').check();
    assert.ok(await page.locator('[data-cram-mode="mixed"]').isEnabled());
    await page.screenshot({path:`/tmp/grove-compact-${device}-cram-${mode}.png`});
   }
  }
  await page.setViewportSize({width:390,height:740});await page.evaluate(()=>showGroveRewards());
  await page.getByRole('tab',{name:'Ground',exact:true}).click();
  const before=await page.evaluate(()=>JSON.stringify([S.pts,S.stars,S.learning,S.groveRewards]));
  await page.reload();await page.evaluate(()=>{window.say=()=>{};showGroveRewards()});
  assert.equal(await page.getByRole('tab',{name:'Ground',exact:true}).getAttribute('aria-selected'),'true');
  await page.getByRole('tab',{name:'Visitors',exact:true}).click();
  await page.getByRole('button',{name:'Invite zoo friend 2',exact:true}).click();
  assert.equal(await page.getByRole('tab',{name:'Visitors',exact:true}).getAttribute('aria-selected'),'true','Purchases and selections retain the current category');
  await page.evaluate(()=>{delete S.groveRewards.equipped.visitors;save()});
  assert.equal(await page.evaluate(()=>JSON.stringify([S.pts,S.stars,S.learning,S.groveRewards])),before,'Layout navigation must preserve learning and balances');
  await page.evaluate(()=>showWritingIdeas());
  assert.equal(await page.locator('#grove-action-notice').isVisible(),false,'Navigation clears the notice from the previous screen');
  await page.locator('#writing-input').fill('狗');await page.locator('#writing-generate').click();
  await fits(page.locator('#writing-finish'), 'phone sentence reward');
  await page.screenshot({path:'/tmp/grove-compact-phone-writing.png'});
  await page.evaluate(()=>listen(ALL.find(c=>c.c==='祖')));await page.evaluate(()=>new Promise(requestAnimationFrame));await fits(page.locator('.choices button').last(),'phone listening choices');
  assert.ok((await page.locator('#reward-strip').boundingBox()).height<=76,'Character progress must remain a compact readable row');
  await page.screenshot({path:'/tmp/grove-compact-phone-listen.png'});
  await page.setViewportSize({width:1180,height:740});await page.evaluate(()=>dictStart('祖'));
  await fits(page.locator('#dc'),'iPad handwriting paper');await fits(page.locator('#dchk'),'iPad pinyin submit');
  assert.ok((await page.locator('#dc').boundingBox()).width>=280,'Keep ample handwriting space');
  await page.screenshot({path:'/tmp/grove-compact-ipad-dictation.png'});
  for(const grade of ['K','1']){
   await page.evaluate(grade=>{const id='paths-'+grade;PR={cur:id,list:[{id,name:'Learner',gr:grade,av:'🐳'}]};savePR();S=blank();localStorage.setItem('zh_p_'+id,JSON.stringify(S));loadS();window.say=()=>{};home()},grade);
   const progress=await page.evaluate(()=>JSON.stringify([S.pts,S.stars,S.learning]));
   for(const [device,width,height]of [['phone',390,740],['ipad',820,1060],['desktop',1440,900]]){
    await page.setViewportSize({width,height});
    for(const mode of ['light','dark']){
     await page.evaluate(mode=>{setAppearance(mode);home()},mode);
     const paths=page.locator('.study-home-entries button');
     assert.equal(await paths.count(),2,grade+' Home has Practice and Review');
     for(const path of await paths.all()){const r=await path.boundingBox();assert.ok(r.height>=44);await fits(path,grade+' '+device+' learning entry');}
     await page.screenshot({path:`/tmp/grove-paths-${grade}-${device}-${mode}.png`});
    }
   }
   await page.evaluate(()=>memory(practiceCards()[0]));
   assert.ok(await page.getByRole('heading',{name:'Draw from Memory',exact:true}).isVisible(),'Memory opens directly for '+grade);
   assert.ok(await page.locator('#hw svg').isVisible(),'Memory provides a handwriting area');
   assert.equal(await page.evaluate(()=>JSON.stringify([S.pts,S.stars,S.learning])),progress,'Opening paths leaves earned progress intact');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: compact Practice/Review entries for all grades and retained Memory activity; first-screen tools/progress, reward categories/projects/ground cards, keyboard tabs, persistent category, visible cram start/multi-select, writing completion and preserved state on iPhone/iPad in both themes.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
