const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4194');
  for(const grade of ['K','1','2']){
   await page.evaluate(grade=>{
    PR={cur:'home-test',list:[{id:'home-test',name:'Synthetic',gr:grade,av:'🐼'},{id:'sibling',name:'Sibling',gr:'4',av:'🐳'}]};savePR();loadS();
    S=blank();S.stars=42;S.opaque={keep:['original']};S.cfg.set=['狗','努','猫','牛','像'];save();setCards();say=()=>{};
    const c=ALL.find(c=>c.c==='十');startStudyRound('practice',{units:[],chars:['十'],modes:['trace'],limit:3},[c],[['trace',c]]);home();
   },grade);
   const baseline=await page.evaluate(()=>backup());
   assert.equal(await page.locator('#sets').count(),0,'Home no longer renders the full unit catalog');
   assert.equal(await page.getByRole('button',{name:'My badges',exact:true}).count(),1);
   assert.equal(await page.getByRole('button',{name:'Grove rewards',exact:true}).count(),1);
   assert.equal(await page.locator('.grove-quick-links button').count(),1,'Home keeps only the progress shortcut');
   await page.getByRole('button',{name:'My progress',exact:true}).click();
   assert.ok(await page.getByRole('heading',{name:'My progress',exact:true}).isVisible(),grade+' can reach progress');
   await page.locator('#progress-characters > summary').click();
   assert.ok(await page.locator('#sets').isVisible());
   assert.equal(await page.evaluate(()=>backup()),baseline,'Opening progress and the catalog cannot save new evidence');
   assert.equal(await page.locator('#sets .set').count()>0,true);
   await page.locator('#grove-view-list').click();
   assert.equal(await page.locator('#grove-view-list').getAttribute('aria-pressed'),'true');
   // The deliberate view preference may save, but browsing cannot change learner evidence or the paused round.
   const afterView=await page.evaluate(()=>backup());
   assert.equal(await page.evaluate(()=>S.stars),42);assert.deepEqual(await page.evaluate(()=>S.opaque),{keep:['original']});
   if(!await page.locator('#sets .character-tile').count())await page.locator('#sets .set > button[aria-expanded]').first().click();
   const tile=page.locator('#sets .character-tile').first();await tile.click();
   await page.locator('#dov').waitFor();assert.ok(await page.getByRole('button',{name:'Play sound',exact:true}).isVisible());
   await page.locator('#dov').getByRole('button',{name:'Close',exact:true}).click();
   if(grade==='2'){await page.getByRole('searchbox',{name:'Search by pinyin',exact:true}).fill('nu');await page.locator('#sres button').first().click();await page.locator('#dov').waitFor();await page.locator('#dov').getByRole('button',{name:'Close',exact:true}).click();}
   await page.locator('#sets .pset').first().click();
   assert.ok(await page.locator('#study-continue').isVisible(),'Unit practice retains explicit saved-round choices');
   await page.getByRole('button',{name:'Close session choices',exact:true}).click();
   assert.equal(await page.evaluate(()=>backup()),afterView,'Details and unit setup preserve all synthetic state');
   await page.getByRole('button',{name:'Mandarin Grove, Home',exact:true}).click();
   await page.getByRole('button',{name:'Practice',exact:true}).click();
   assert.ok(await page.locator('#study-continue').isVisible());await page.getByRole('button',{name:'Close session choices',exact:true}).click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.ok(baseline.length>0);
  }
  await page.evaluate(()=>parentDashboard('sibling','4'));
  assert.equal(await page.locator('#progress-characters').count(),0,'Sibling dashboard cannot operate the active learner unit browser');
  assert.equal(await page.evaluate(()=>PR.cur),'home-test');
  assert.deepEqual(errors,[]);
  console.log('PASS: unique Home navigation, K/1/2 progress and character browsing, unit practice/details, saved round and opaque history preservation, sibling isolation.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
