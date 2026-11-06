/* Generated information may scroll; writing/reward actions must remain visible. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {scaleNativeTextStyles}=require('../scripts/native-text-style.cjs');
const fixtures=[
 {width:320,height:568,scale:1.5,top:0,bottom:0},
 {width:360,height:640,scale:1.5,top:24,bottom:16},
 {width:568,height:320,scale:1.5,top:0,bottom:21},
 {width:320,height:568,scale:1,top:0,bottom:0},
 {width:390,height:844,scale:1.5,top:47,bottom:34},
 {width:820,height:1180,scale:1.5,top:24,bottom:20},
 {width:390,height:844,scale:2,top:47,bottom:34}
];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 const cases=[],failures=[],errors=[],writes=[];let complete=false;
 try{
  const url=process.env.APP_URL||'http://127.0.0.1:4173',context=await browser.newContext();
  await context.route('**/*',route=>{const r=route.request();if(!['GET','HEAD','OPTIONS'].includes(r.method())){writes.push(r.method());return route.abort();}if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(url).origin)return route.abort();return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.evaluate(()=>GROVE_STARTED);
  await page.evaluate(async()=>{PR={cur:'writing-layout-qa',list:[{id:'writing-layout-qa',name:'Writing QA',gr:'2',av:'🐼'}],futureWriting:{keep:true}};await savePR();S=blank();S.futureWriting={keep:['unknown']};localStorage.setItem('zh_p_writing-layout-qa',JSON.stringify(S));await loadS();window.say=()=>{};await home();});
  for(const file of ['styles.css','theme.css','mistakes.css','app-layout.css'])await page.addStyleTag({content:scaleNativeTextStyles(fs.readFileSync(path.join(__dirname,'..',file),'utf8'))});
  const profile=page.locator('#profile-ui-style');await profile.evaluate((e,s)=>e.textContent=s,scaleNativeTextStyles(await profile.textContent()));
  async function check(fixture,phase){
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const geometry=await page.evaluate(f=>{
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
    const controls=[...document.querySelectorAll('#page-back,#writing-generate,#writing-another,#writing-finish,#writing-confirm,#writing-keep')].filter(e=>!e.disabled&&e.checkVisibility()&&!e.closest('[hidden]')).map(e=>{
     const r=rect(e),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),clipped=[];
     for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflowY)&&(r.y<b.top-1||r.bottom>b.bottom+1))clipped.push(p.id||p.className);}
     return{id:e.id,...r,inside:r.y>=f.top-1&&r.bottom<=f.height-f.bottom+1&&r.x>=-1&&r.right<=f.width+1,hit:e.disabled||e===hit||e.contains(hit),clipped};
    });
    const prompt=document.querySelector('.writing-prompt'),main=document.getElementById('app');
    const information=document.querySelector('.writing-seed-information');
    return{controls,mainScroll:main.scrollHeight-main.clientHeight,prompt:prompt&&rect(prompt),information:information&&rect(information),text:getComputedStyle(document.body).fontSize};
   },fixture);
   for(const c of geometry.controls)if(!c.inside||!c.hit||c.clipped.length||c.width<43.5||c.height<43.5)failures.push({fixture,phase,issue:'Primary action requires scrolling or is obscured',control:c});
   if(geometry.mainScroll>1)failures.push({fixture,phase,issue:'Writing task requires page scrolling',geometry});
   if(!geometry.information||geometry.information.height<44)failures.push({fixture,phase,issue:'Writing prompt needs a usable reading area',geometry});
   if(geometry.text!==fixture.scale*16+'px')failures.push({fixture,phase,issue:'Text scale changed',geometry});
   cases.push({fixture,phase,geometry});
  }
  for(const fixture of fixtures){
   await page.setViewportSize({width:fixture.width,height:fixture.height});await page.evaluate(async f=>{for(const [k,v]of Object.entries({top:f.top,right:0,bottom:f.bottom,left:0}))document.documentElement.style.setProperty('--safe-area-inset-'+k,v+'px');document.documentElement.style.setProperty('--grove-text-scale',String(f.scale));await home();WRITING_IDEAS_SESSION=null;showWritingIdeas();window.writingBefore=await backup();},fixture);
   await page.locator('#writing-input').fill('学校');await page.locator('#writing-generate').click();await check(fixture,'generated');
   assert(await page.evaluate(async()=>await backup()===writingBefore),'Generating an idea does not change progress');
   // Invoke the actual handler even on RED, so every obscured branch is measured.
   await page.locator('#writing-finish').evaluate(e=>e.click());await check(fixture,'confirming');
   await page.locator('#writing-keep').evaluate(e=>e.click());await check(fixture,'cancelled');
   assert(await page.evaluate(async()=>await backup()===writingBefore),'Cancelling celebration preserves the exact save');
   await page.locator('#writing-finish').evaluate(e=>e.click());await page.locator('#writing-confirm').evaluate(e=>e.click());await page.waitForFunction(()=>WRITING_IDEAS_SESSION?.claim?.done);await check(fixture,'completed');
   assert(await page.evaluate(()=>S.futureWriting.keep[0]==='unknown'&&PR.futureWriting.keep),'Unknown save fields remain exact');
   const saved=await page.evaluate(()=>backup());await page.locator('#writing-another').click();assert.equal(await page.evaluate(()=>backup()),saved,'Trying another idea does not repeat the reward');
   const information=page.locator('.writing-seed-information');if(await information.count()&&await information.evaluate(e=>e.scrollHeight>e.clientHeight+1)){assert(await information.evaluate(e=>e.tabIndex)>=0);await information.focus();await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>document.querySelector('.writing-seed-information').scrollTop>0);}
  }
  complete=true;
 }finally{await browser.close();const report={complete,cases,failures,pageErrors:errors,httpWrites:writes};if(process.env.GROVE_WRITING_REPORT)fs.writeFileSync(process.env.GROVE_WRITING_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({complete,cases:cases.length,failures:failures.length,pageErrors:errors.length,httpWrites:writes.length}));if(!complete||cases.length!==fixtures.length*4||failures.length||errors.length||writes.length)process.exitCode=1;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
