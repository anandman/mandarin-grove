const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.APP_URL||'http://127.0.0.1:4173');
 await page.evaluate(()=>{
  localStorage.setItem('zh_profiles',JSON.stringify({cur:'reward',list:[{id:'reward',name:'Learner',gr:'K',av:'🐻'},{id:'sibling',name:'Sibling',gr:'2',av:'🐳'}]}));
  localStorage.setItem('zh_p_sibling',JSON.stringify(blank()));
  const s={stars:120,streak:0,last:'',pts:{},box:{},due:{},cfg:{}};
  for(let i=0;i<120;i++)recordSkill(s,'狗','trace','assisted');
  localStorage.setItem('zh_p_reward',JSON.stringify(s));
 });await page.reload();await page.evaluate(()=>home());
 assert.ok(await page.locator('#reward-strip').isVisible());
 assert.equal(await page.evaluate(()=>S.rewards.ribbons),12);
 assert.equal(await page.evaluate(()=>S.stars),120);
 await page.getByRole('button',{name:'My badges',exact:true}).click();
 assert.match(await page.locator('#app').innerText(),/120 practice steps/);
 assert.match(await page.locator('#app').innerText(),/Practice challenges/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.locator('.reward-card progress').evaluateAll(els=>els.every(el=>el.getBoundingClientRect().right<=el.parentElement.getBoundingClientRect().right)),true);
 await page.screenshot({path:'/tmp/hanzi-rewards.png',fullPage:true});
 for(let i=0;i<2;i++){
  await page.evaluate(()=>{home();listen(ALL.find(c=>c.c==='狗'))});
  await page.locator('[data-c="狗"]').click();
 }
 assert.equal(await page.evaluate(()=>S.rewards.characters['狗'].tier),1);
 assert.match(await page.locator('#reward-notice').innerText(),/Character badge earned/);
 assert.notEqual(await page.evaluate(()=>characterStage(S,'狗')),'Mastered');
 await page.evaluate(()=>{recordSkill(S,'狗','listen','miss');save()});
 await page.reload();await page.evaluate(()=>home());
 assert.equal(await page.evaluate(()=>S.rewards.characters['狗'].tier),1);
 assert.equal(await page.evaluate(()=>refreshRewardState(S,GR()).length),0);
 for(const grade of ['K','1','2','3','4','5']){
  await page.evaluate(g=>{PR.list[0].gr=g;home()},grade);
  assert.ok(await page.locator('#reward-strip').isVisible());
  assert.equal(await page.getByRole('button',{name:'My progress',exact:true}).count(),Number(grade)>=2?1:0);
 }
 await page.evaluate(()=>{PR.cur='sibling';savePR();loadS();home()});
 assert.equal(await page.evaluate(()=>S.rewards.ribbons),0);
 assert.equal(await page.evaluate(()=>Object.keys(S.rewards.characters).length),0);
 assert.deepEqual(errors,[]);await browser.close();
 console.log('PASS: retroactive ribbons, same-day badge through real listening UI, permanent awards, reload, all-grade reward visibility, Grade2 dashboard, profile isolation and mobile layout.');
})().catch(e=>{console.error(e);process.exit(1)});
