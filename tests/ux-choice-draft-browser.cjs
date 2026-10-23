const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});try{
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.APP_URL||'http://127.0.0.1:4194');
for(const chars of [['狗'],['狗','猫']]){
 await page.evaluate(chars=>{document.querySelectorAll('dialog').forEach(d=>d.remove());PR={cur:'draft',list:[{id:'draft',name:'Synthetic',gr:'2',av:'🐼'}]};savePR();loadS();S=blank();S.cfg.set=chars;S.cfg.notLearned=['狗'];S.cfg.studyChoices={'2':{review:{units:[],chars,modes:['flip'],limit:5}}};save();setCards();say=()=>{};home();showStudySetup('review');},chars);
 await page.locator('#study-choice-editor > summary').click();await page.locator('#study-deferred > summary').click();await page.getByRole('button',{name:'Add 狗',exact:true}).click();
 assert.equal(await page.locator('#study-start').isEnabled(),true,'Restored-only selection can start');assert.match(await page.locator('#study-start').innerText(),new RegExp(chars.length+' question'));
 assert.deepEqual(await page.evaluate(()=>S.cfg.notLearned),['狗'],'Preview does not persist draft eligibility');
 await page.locator('#study-recent-mistakes').click();assert.equal(await page.locator('dialog[open]').count(),1,'Review list is not stacked over setup');await page.getByRole('button',{name:'Close things to practice',exact:true}).click();await page.locator('#study-start').waitFor();assert.equal(await page.locator('#study-start').isEnabled(),true,'Returning preserves the restored draft');
 await page.locator('#study-start').click();assert.deepEqual(await page.evaluate(()=>SESS.round.q.map(([,c])=>c).sort()),[...chars].sort());assert.deepEqual(await page.evaluate(()=>S.cfg.notLearned),[],'Launch applies exactly the draft eligibility');
}
assert.deepEqual(errors,[]);console.log('PASS: restored-only and mixed draft selections preview/launch accurate counts without premature writes, including returning from the one-dialog Review list.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
