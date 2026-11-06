/* Native text growth must preserve the header and a full-width session toolbar. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {scaleNativeTextStyles}=require('../scripts/native-text-style.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 const failures=[],cases=[],errors=[],writes=[];
 try{
  const origin=process.env.APP_URL||'http://127.0.0.1:4173',context=await browser.newContext();
  await context.route('**/*',route=>{
   const r=route.request();
   if(!['GET','HEAD','OPTIONS'].includes(r.method())){writes.push(r.method());return route.abort();}
   if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(origin).origin)return route.abort();
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.evaluate(()=>GROVE_STARTED);
  await page.evaluate(async()=>{PR={cur:'text-synthetic',list:[{id:'text-synthetic',name:'Viewport learner',gr:'2',av:'🐼'}]};await savePR();S=blank();S.cfg.set=['学'];localStorage.setItem('zh_p_text-synthetic',JSON.stringify(S));await loadS();window.say=()=>{};await home();});
  for(const file of ['styles.css','theme.css','mistakes.css','app-layout.css'])await page.addStyleTag({content:scaleNativeTextStyles(fs.readFileSync(path.join(__dirname,'..',file),'utf8'))});
  const style=page.locator('#profile-ui-style');await style.evaluate((el,text)=>el.textContent=text,scaleNativeTextStyles(await style.textContent()));
  await page.evaluate(()=>document.documentElement.style.setProperty('--grove-text-scale','1.5'));
  for(const viewport of [{width:320,height:568},{width:360,height:640},{width:390,height:844}]){
   await page.setViewportSize(viewport);await page.evaluate(async()=>{await home();const c=ALL.find(c=>c.c==='学');await startStudyRound('practice',{units:[],chars:['学'],modes:['trace'],limit:5},[c],[['trace',c]]);});
   await page.waitForFunction(()=>writer?._quiz&&document.querySelectorAll('#hw path').length>0);
   await page.evaluate(()=>{window.textKeptWriter=writer;window.textKeptQuiz=writer._quiz;window.textKeptState=JSON.stringify(S);});
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const geometry=await page.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const header=document.querySelector('body > header'),heading=document.querySelector('.activity-frame-heading'),bar=document.querySelector('.study-sessionbar');
    return{header:rect(header),heading:rect(heading),bar:rect(bar),fontScale:getComputedStyle(document.body).fontSize,controls:[...header.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().height).map(e=>{const r=rect(e),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{...r,hit:hit===e||e.contains(hit)};})};
   });
   if(geometry.header.height>72)failures.push({viewport,issue:'Header must retain one usable row',geometry});
   if(Math.abs(geometry.bar.width-geometry.heading.width)>1)failures.push({viewport,issue:'Session toolbar must use full heading width',geometry});
   for(const c of geometry.controls)if(c.x<0||c.right>viewport.width+1||c.width<43.5||c.height<43.5||!c.hit)failures.push({viewport,issue:'Header control not usable',control:c});
   assert.equal(geometry.fontScale,'24px','Keep native150% body text; do not shrink the page');
   await page.setViewportSize({width:820,height:1180});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   assert.equal(await page.evaluate(()=>writer===textKeptWriter&&writer._quiz===textKeptQuiz&&JSON.stringify(S)===textKeptState),true,'Reflow preserves the same writer, quiz and saved state');
   cases.push({viewport,geometry});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 }finally{
  await browser.close();const report={cases,failures,pageErrors:errors,unexpectedWrites:writes};
  if(process.env.GROVE_LARGE_TEXT_REPORT)fs.writeFileSync(process.env.GROVE_LARGE_TEXT_REPORT,JSON.stringify(report,null,2));
  console.log(JSON.stringify({cases:cases.length,failures:failures.length,pageErrors:errors.length,unexpectedWrites:writes.length}));
 }
 assert.equal(cases.length,3);assert.equal(failures.length,0);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
