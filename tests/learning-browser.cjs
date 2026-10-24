const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.APP_URL||'http://127.0.0.1:4181');
 await page.evaluate(()=>{localStorage.setItem('zh_profiles',JSON.stringify({list:[{id:'learning',name:'Learner',av:'🐳',gr:'4'},{id:'other',name:'Sibling',av:'🐻',gr:'2'}],cur:'learning'}));localStorage.setItem('zh_p_other',JSON.stringify(blank()));localStorage.setItem('zh_p_learning',JSON.stringify({stars:100,pts:{狗:5},box:{},due:{},cfg:{}}))});await page.reload();await page.evaluate(()=>home());
 await page.evaluate(()=>{showCram();selectCramUnits(true);startCram();SESS.q.sort((a,b)=>(a[0]==='listen'?-1:0)-(b[0]==='listen'?-1:0));SESS.i=0;nextItem()});
 assert.equal(await page.evaluate(()=>SESS.q.length),30);
 const q=await page.evaluate(()=>SESS.q.map(([m,c])=>[m,c.c]));
 assert.equal(new Set(q.map(x=>x.join(':'))).size,30);
 await page.evaluate(()=>{finishReview('correct');finishReview('correct')});
 assert.equal(await page.evaluate(()=>Object.values(S.learning.chars).reduce((n,c)=>n+Object.values(c.skills).reduce((a,r)=>a+r.attempts,0),0)),1);
 await page.reload();await page.evaluate(()=>home());await page.getByRole('button',{name:'Continue earlier unit review',exact:true}).click();
 assert.equal(await page.evaluate(()=>SESS.i),2);
 assert.deepEqual(await page.evaluate(()=>SESS.q.map(([m,c])=>[m,c.c])),q);
 await page.evaluate(()=>{SESS.i=SESS.q.length;nextItem()});await page.getByRole('button',{name:'Practice again',exact:true}).click();assert.equal(await page.evaluate(()=>SESS.q.length),30);
 await page.evaluate(()=>{home();listen(ALL.find(c=>c.c==='狗'))});
 await page.locator('.choices button:not([data-c="狗"])').first().click();await page.locator('[data-c="狗"]').click();
 assert.equal(await page.evaluate(()=>skillState(S,'狗','listen').misses),1);
 await page.evaluate(()=>{home();flip(ALL.find(c=>c.c==='狗'))});await page.locator('#cd').click();await page.locator('#yes').click();
 assert.equal(await page.evaluate(()=>skillState(S,'狗','flip').correct),1);
 await page.evaluate(()=>{home();grown()});await page.getByRole('button',{name:'Parent dashboard',exact:true}).click();
 assert.ok(await page.getByRole('heading',{name:'Parent dashboard'}).isVisible());
 await page.locator('#dash-grade').selectOption('2');
 await page.evaluate(()=>{
  const start=Date.now()-4*REVIEW_DAY;
  for(const mode of ['listen','memory','pinyin']){
   delete S.learning.chars['狗'].skills[mode];let t=start;
   for(let i=0;i<3;i++){recordSkill(S,'狗',mode,'correct',t);t=skillState(S,'狗',mode).due;}
  }
  save();parentDashboard(PR.cur,'2');
 });
 assert.equal(await page.evaluate(()=>characterStage(S,'狗')),'Mastered');
 await page.getByText('Learning details · 151 characters',{exact:true}).click();
 assert.match(await page.locator('#app').innerText(),/狗 · Mastered/);
 await page.getByText('How progress works',{exact:true}).click();
 assert.match(await page.locator('#app').innerText(),/elapsed days, at most once per calendar day/);

 assert.match(await page.locator('#app').innerText(),/狗/);
 await page.locator('#dash-child').selectOption('other');assert.equal(await page.evaluate(()=>PR.cur),'learning');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/hanzi-parent-dashboard.png',fullPage:true});
 await page.evaluate(()=>{home();showCram();selectCramUnits(true);startCram('dictation')});assert.ok(await page.evaluate(()=>DQ.q.length<=30));
 await page.reload();await page.evaluate(()=>home());await page.getByRole('button',{name:'Continue earlier Listen & Write'}).click();assert.ok(await page.locator('#dc').isVisible());
 assert.deepEqual(errors,[]);await browser.close();console.log('Learning browser checks passed: cap, dedup, resume, evidence, dashboard, profile isolation, mobile, pinyin resume.');
})().catch(e=>{console.error(e);process.exit(1)});
