const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}),failures=[];
async function run(name,fn){const c=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),p=await c.newPage(),errors=[];p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));await p.route('**/api/feedback',r=>r.abort());try{await p.goto(process.env.APP_URL||'http://127.0.0.1:4201');await p.evaluate(()=>{PR={cur:'bulk-synthetic',list:[{id:'bulk-synthetic',name:'Synthetic',gr:'4',av:'🐼'},{id:'bulk-other',name:'Other',gr:'2',av:'🐯'}]};savePR();loadS();S.stars=99;S.opaque={keep:'original'};const cfg={units:['4:1'],chars:[...QU('4')[0][1]],modes:['flip'],limit:10};S.cfg.studyChoices={4:{practice:cfg,review:JSON.parse(JSON.stringify(cfg))}};S.cfg.notLearned=['雨'];S.cfg.studyRounds={4:{review:{id:'paused-original',kind:'review',config:cfg,q:[['flip',cfg.chars[0]]],cursor:0,results:{}}}};save();say=()=>{};home();});await fn(p);assert.deepEqual(errors,[]);console.log('PASS:',name);}catch(e){failures.push(name);console.error('FAIL:',name,e.stack);}finally{await c.close();}}
async function choices(p,kind='practice'){await p.evaluate(k=>showStudySetup(k),kind);await p.locator('#study-choice-editor > summary').click();}
async function grade(p,g){const group=p.locator('.study-unit-picker>details').filter({has:p.locator('[data-study-grade="'+g+'"]')});if(await group.getAttribute('open')===null)await group.locator(':scope > summary').click();return p.locator('[data-study-grade="'+g+'"]');}
try{
 for(const kind of ['practice','review'])await run(kind+' grade selection covers extras, exclusions, partial state and cancel without changing progress',async p=>{
  const before=await p.evaluate(()=>backup());await choices(p,kind);assert.equal(await p.locator('[data-study-grade]').count(),6);assert.equal(await p.locator('[data-study-grade="4"]').evaluate(e=>e.indeterminate),true);
  const k=await grade(p,'K');await k.check();assert.ok(await p.locator('[data-study-char="友"]').isChecked());assert.equal(await p.locator('[data-study-char="雨"]').isChecked(),false);assert.equal(await p.locator('[data-study-char="雨"]').isDisabled(),true);assert.equal(await p.locator('[data-study-unit="4:1"]').isChecked(),true);
  const unit=p.locator('[data-study-unit="K:2"]');await unit.uncheck();assert.equal(await k.evaluate(e=>e.indeterminate),true);await k.check();assert.equal(await unit.isChecked(),true);
  const one=await grade(p,'1');await one.check();await k.uncheck();assert.equal(await p.locator('[data-study-char="友"]').isChecked(),true,'another selected grade retains a shared character');assert.equal(await one.isChecked(),true);await one.focus();await p.keyboard.press('Space');assert.equal(await one.isChecked(),false);await p.keyboard.press('Space');assert.equal(await one.isChecked(),true);assert.equal(await p.locator('[data-study-unit="4:1"]').isChecked(),true);
  await p.getByRole('button',{name:'Close session choices',exact:true}).click();assert.equal(await p.evaluate(()=>backup()),before);
 });
 await run('bulk choices persist through Read Chinese and reload while keeping the paused round',async p=>{
  const before=await p.evaluate(()=>({round:JSON.stringify(S.cfg.studyRounds),stars:S.stars,learning:JSON.stringify(S.learning)}));await choices(p,'review');for(const g of ['K','1','2'])await (await grade(p,g)).check();await p.locator('#study-reading').click();await p.locator('[data-reading="grove-pets"]').waitFor();
  assert.equal(await p.evaluate(()=>JSON.stringify(S.cfg.studyRounds)),before.round);assert.equal(await p.evaluate(()=>S.stars),before.stars);assert.equal(await p.evaluate(()=>JSON.stringify(S.learning)),before.learning);assert.equal(await p.evaluate(()=>S.cfg.studyChoices['4'].review.chars.includes('雨')),false);
  await p.reload();await choices(p,'review');for(const g of ['K','1','2'])assert.equal(await p.locator('[data-study-grade="'+g+'"]').isChecked(),true);
 });
 await run('an obsolete bulk handler cannot change another child',async p=>{
  await choices(p);await grade(p,'K');const old=await p.evaluate(()=>{window.oldBulk=document.querySelector('[data-study-grade="K"]');window.oldBulkChange=oldBulk.onchange;PR.cur='bulk-other';savePR();loadS();home();return localStorage.getItem('zh_p_bulk-synthetic');});
  await p.evaluate(()=>{oldBulk.checked=true;oldBulkChange();});assert.equal(await p.evaluate(()=>localStorage.getItem('zh_p_bulk-synthetic')),old);assert.equal(await p.evaluate(()=>S.cfg.studyChoices?.['4']),undefined);
 });
}finally{await b.close();}assert.deepEqual(failures,[]);
})().catch(e=>{console.error(e);process.exit(1)});
