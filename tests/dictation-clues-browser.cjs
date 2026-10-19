const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');
  await page.evaluate(()=>{localStorage.setItem('zh_profiles',JSON.stringify({cur:'clues',list:[{id:'clues',name:'Test',gr:'4',av:'🐻'}]}));});await page.reload();
  for(const mode of ['standalone','daily','cram'])for(const char of ['祖','组']){
   await page.evaluate(({mode,char})=>{
    home();const c=ALL.find(x=>x.c===char);
    if(mode==='standalone')dictStart(char);
    else{SESS={q:[['dictation',c]],i:1,cram:mode==='cram'};dictQuestion(c)}
   },{mode,char});
   assert.equal(await page.locator('#dictation-clue').count(),1,'dictation must distinguish homophones before grading');
   assert.equal(await page.locator('#dictation-clue').innerText(),'Meaning: '+(char==='祖'?'grandparent, ancestor':'group'));
   const prompt=await page.locator('#app').innerText();assert.ok(!prompt.includes(char));assert.ok(!prompt.includes('zǔ'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: homophone meaning clues in standalone/daily/cram, no character or pinyin revealed, mobile width.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
