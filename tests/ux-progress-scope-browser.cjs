const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 const failures=[];
 const run=async(name,test)=>{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.setDefaultTimeout(4000);page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(process.env.APP_URL||'http://127.0.0.1:4194');
   await page.evaluate(()=>{PR={cur:'scope-test',list:[{id:'scope-test',name:'Synthetic',gr:'2',av:'🐼'},{id:'sibling',name:'Sibling',gr:'4',av:'🐳'}]};savePR();loadS();S=blank();S.stars=42;S.pts['努']=3;S.opaque={keep:['original']};S.cfg.set=['狗','努','猫','牛','像'];save();setCards();say=()=>{};const c=ALL.find(c=>c.c==='十');startStudyRound('practice',{units:[],chars:['十'],modes:['trace'],limit:3},[c],[['trace',c]]);home();kidProgress();});
   const before=await page.evaluate(()=>backup());
   await test(page);
   assert.equal(await page.evaluate(()=>backup()),before,'Read-only progress, filters and browsing preserve the entire backup');
   assert.deepEqual(errors,[]);console.log('PASS:',name);
  }catch(error){failures.push(name);console.error('FAIL:',name,error.message);}finally{await page.close();}
 };
 try{
  await run('shared Grade and Unit scope without changing learner or paused round',async page=>{
   await page.locator('#dash-grade').selectOption('4');
   await page.locator('#progress-characters > summary').click();
   assert.equal(await page.locator('#sets .set').count(),13);
   assert.match(await page.locator('#progress-characters h2 + span').innerText(),/4th grade/);
   assert.equal(await page.locator('#sets .gh h3').innerText(),'4th grade · PDF units');
   await page.locator('#dash-unit').selectOption({label:'Unit 7'});
   await page.locator('#progress-characters').evaluate(el=>el.open=true);
   assert.equal(await page.locator('#sets .set').count(),1);
   assert.match(await page.locator('#progress-details > summary').innerText(),/9 characters/);
   if(await page.locator('#sets .set > button[aria-expanded]').getAttribute('aria-expanded')==='false')await page.locator('#sets .set > button[aria-expanded]').click();
   assert.equal(await page.locator('#sets .character-tile').count(),9);
   await page.locator('#sets .pset').click();
   assert.equal(await page.locator('#study-continue').count(),1,'Existing round remains available');
   assert.deepEqual(await page.evaluate(()=>STUDY_DRAFT.config.chars),['断','寻','据','墙','块','拼','休','始','冲']);
   await page.getByRole('button',{name:'Close session choices',exact:true}).click();
   assert.equal(await page.evaluate(()=>GR()),'2');
  });
  await run('search the full shown curriculum by Hanzi, pinyin and meaning',async page=>{
   await page.locator('#progress-characters > summary').click();
   for(const query of ['防','fang2','protect']){
    await page.locator('#srch').fill(query);
    const result=page.locator('#sres button').filter({hasText:'防'});
    assert.equal(await result.count(),1,'Late-unit 防 is searchable with '+query);
    await result.click();await page.locator('#dov').waitFor();
    assert.equal(await page.locator('#dov').getAttribute('aria-label'),'防 character details');
    await page.keyboard.press('Escape');
   }
   await page.locator('#sres button').filter({hasText:'防'}).click();await page.locator('#dov').waitFor();
   await page.locator('#detail-practice').click();assert.deepEqual(await page.evaluate(()=>STUDY_DRAFT.config.chars),['防']);
   await page.getByRole('button',{name:'Close session choices',exact:true}).click();
   await page.locator('#srch').fill('does-not-exist');
   assert.equal(await page.locator('#sres button').count(),0);
   assert.match(await page.locator('#search-status').innerText(),/No characters/);
   assert.equal(await page.locator('#search-status').getAttribute('role'),'status');
   await page.locator('#dash-unit').selectOption({label:'Unit 1'});
   await page.locator('#progress-characters').evaluate(el=>el.open=true);
   await page.locator('#srch').fill('防');
   assert.equal(await page.locator('#sres button').count(),0,'Search respects the same Unit filter');
  });
  await run('Kindergarten supplemental cards remain reachable and share assessed scope',async page=>{
   await page.locator('#dash-grade').selectOption('K');
   await page.locator('#progress-characters').evaluate(el=>el.open=true);
   assert.ok(await page.locator('#srch').isVisible());
   assert.match(await page.locator('#progress-details > summary').innerText(),/90 characters/);
   await page.locator('#srch').fill('鱼');
   await page.locator('#sres button').filter({hasText:'鱼'}).click();await page.locator('#dov').waitFor();
   assert.equal(await page.locator('#dov').getAttribute('aria-label'),'鱼 character details');
   await page.keyboard.press('Escape');
   await page.evaluate(()=>parentDashboard('sibling','4'));
   assert.equal(await page.locator('#progress-characters').count(),0);
   assert.equal(await page.evaluate(()=>PR.cur),'scope-test');
  });
 }finally{await browser.close();}
 assert.deepEqual(failures,[]);
})().catch(e=>{console.error(e);process.exit(1)});
