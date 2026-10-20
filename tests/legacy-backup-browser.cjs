// Synthetic data in the exact PR/data backup format of the recovered original app.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1180,height:820}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4173');
  const fixture=await page.evaluate(()=>{
   const time=1700000000000;
   const profiles={cur:'legacy-a',list:[{id:'legacy-a',name:'Old Learner A',gr:'4',av:'🐳'},{id:'legacy-b',name:'Old Learner B',gr:'1',av:'🐼'}]};
   const states={
    'legacy-a':{stars:149,streak:7,last:today(),pts:{祖:6,止:5,离:3,子:1},box:{祖:3,子:1},due:{祖:20000,子:19998},ok:{祖:time},bad:{s7:time,pq:time},cfg:{test:'',quiz:'',set:['祖','止','离','子']},originalExtra:{keep:true}},
    'legacy-b':{stars:48,streak:2,last:today(),pts:{天:5,人:2},box:{天:2},due:{天:20004},bad:{pq:time},cfg:{test:'',quiz:'',set:['天','人']}}
   };
   const code=btoa(unescape(encodeURIComponent(JSON.stringify({PR:profiles,data:Object.fromEntries(Object.entries(states).map(([id,s])=>[id,JSON.stringify(s)]))}))));
   PR={cur:'placeholder',list:[{id:'placeholder',name:'Temporary profile',gr:'2',av:'🐼'}]};savePR();loadS();home();
   return {profiles,states,code};
  });
  const restore=async code=>{
   await page.evaluate(()=>grown());await page.locator('#grest').click();await page.locator('#grt').fill(code);
   await page.locator('#grr').click();
  };
  await restore(fixture.code);
  for(const id of ['legacy-a','legacy-b']){
   await page.evaluate(id=>{PR.cur=id;savePR();loadS();home();},id);
   const actual=await page.evaluate(()=>JSON.parse(JSON.stringify(S)));
   for(const [key,value]of Object.entries(fixture.states[id]))assert.deepEqual(actual[key],value,id+' preserved '+key);
   assert.equal(await page.evaluate(()=>mastered()),id==='legacy-a'?2:1,'Original earned zoo friends stay unlocked');
   assert.equal(await page.evaluate(()=>characterStage(S,Object.keys(S.pts)[0])),'Previously practiced');
   assert.equal(Object.keys(actual.learning?.chars||{}).length,0,'Old stars do not prove separate listening/pinyin mastery');
   assert.equal(await page.evaluate(()=>unitGroveGrowth(S.cfg.set).practiced),fixture.states[id].cfg.set.length);
  }
  const code=await page.evaluate(()=>backup());await page.reload();await restore(code);
  for(const id of ['legacy-a','legacy-b']){
   await page.evaluate(id=>{PR.cur=id;savePR();loadS();home();},id);
   const actual=await page.evaluate(()=>JSON.parse(JSON.stringify(S)));
   for(const [key,value]of Object.entries(fixture.states[id]))assert.deepEqual(actual[key],value,id+' round-trip preserved '+key);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: original-format UI restore preserves both profiles, exact character progress, zoo, stars, badges, review fields/settings, visible practiced trees and export/re-import.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
