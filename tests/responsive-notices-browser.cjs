const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {scaleNativeTextStyles}=require(path.join(process.cwd(),'scripts/native-text-style.cjs'));
(async()=>{
 const failures=[],cases=[],errors=[],writes=[];
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 try{
  const url=process.env.APP_URL||'http://127.0.0.1:4173',context=await browser.newContext();
  await context.route('**/*',route=>{
   const req=route.request();if(!['GET','HEAD','OPTIONS'].includes(req.method())){writes.push(req.method());return route.abort();}
   if(/^https?:/.test(req.url())&&new URL(req.url()).origin!==new URL(url).origin)return route.abort();return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.evaluate(()=>GROVE_STARTED);
  await page.evaluate(async()=>{PR={cur:'notice-synthetic',list:[{id:'notice-synthetic',name:'Viewport learner',gr:'K',av:'🐼'}]};await savePR();S=blank();S.cfg.set=['一','二'];localStorage.setItem('zh_p_notice-synthetic',JSON.stringify(S));await loadS();window.say=()=>{};await home();});
  for(const file of ['styles.css','theme.css','mistakes.css','app-layout.css'])await page.addStyleTag({content:scaleNativeTextStyles(fs.readFileSync(path.join(process.cwd(),file),'utf8'))});
  await page.evaluate(()=>document.documentElement.style.setProperty('--grove-text-scale','1'));
  for(const viewport of [{width:427,height:951,top:68,bottom:24},{width:390,height:844,top:47,bottom:34}])for(const notice of ['reward','speech','both']){
   await page.setViewportSize(viewport);await page.evaluate(async ({v,notice})=>{document.documentElement.style.setProperty('--safe-area-inset-top',v.top+'px');document.documentElement.style.setProperty('--safe-area-inset-bottom',v.bottom+'px');await home();const c=ALL.find(c=>c.c==='一');await startStudyRound('practice',{units:[],chars:['一','二'],modes:['listen'],limit:5},[c],[['listen',c]]);window.noticeKeptFrame=document.querySelector('.activity-frame');window.noticeKeptBackup=await backup();speechStatus('');if(notice!=='speech')announceRewards([{kind:'ribbon'},{kind:'character',char:'一',tier:1},{kind:'challenge',icon:'👣',name:'First steps'},{kind:'fruit',amount:1}]);if(notice!=='reward')speechStatus('No installed Mandarin device voice is available. Add a voice in device Settings and tap Refresh voices. Recordings still work.');},{v:viewport,notice});
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const geometry=await page.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const back=document.querySelector('#page-back'),notice=document.querySelector('#reward-notice'),status=document.querySelector('#speech-status'),b=rect(back),n=notice&&!notice.hidden?rect(notice):null,s=status&&!status.hidden?rect(status):null;
    const intersects=r=>r&&Math.min(b.right,r.right)-Math.max(b.x,r.x)>.5&&Math.min(b.bottom,r.bottom)-Math.max(b.y,r.y)>.5;
    const controls=[...document.querySelectorAll('.activity-frame button, #reward-notice button')].filter(e=>!e.closest('[hidden]')&&e.getBoundingClientRect().width&&e.getBoundingClientRect().height).map(e=>{const r=rect(e),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{...r,id:e.id||'activity-control',unobscured:hit===e||e.contains(hit)};});
    return{controls,back:b,notice:n,speechStatus:s,noticeOverlapsBack:intersects(n),speechStatusOverlapsBack:intersects(s),backCorners:[{x:b.x+4,y:b.y+4},{x:b.right-4,y:b.y+4},{x:b.x+4,y:b.bottom-4},{x:b.right-4,y:b.bottom-4}].map(p=>{const h=document.elementFromPoint(p.x,p.y);return h===back||back.contains(h);})};
   });
   for(const control of geometry.controls)if(control.width<43.5||control.height<43.5||control.x<0||control.right>viewport.width+.5||control.y<viewport.top-.5||control.bottom>viewport.height-viewport.bottom+.5||!control.unobscured)failures.push({viewport,notice,issue:'Activity or notice action must remain usable',control});
   if(geometry.noticeOverlapsBack||geometry.speechStatusOverlapsBack||geometry.backCorners.some(x=>!x))failures.push({viewport,notice,issue:'Back is partially covered by ordinary reward/speech notices',geometry});
   if(process.env.GROVE_NOTICE_SCREENSHOTS){fs.mkdirSync(process.env.GROVE_NOTICE_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.GROVE_NOTICE_SCREENSHOTS,`notice-${viewport.width}x${viewport.height}-${notice}.png`)});}
   if(notice!=='speech')await page.getByRole('button',{name:'Dismiss reward message',exact:true}).click();assert.equal(await page.evaluate(async()=>document.querySelector('.activity-frame')===noticeKeptFrame&&(await backup())===noticeKeptBackup),true,'Dismissing information retains the same activity and exact save');cases.push({viewport,notice,geometry});
  }
 }finally{await browser.close();if(process.env.GROVE_NOTICE_REPORT)fs.writeFileSync(process.env.GROVE_NOTICE_REPORT,JSON.stringify({cases,failures,pageErrors:errors,unexpectedWrites:writes},null,2)+'\n');console.log(JSON.stringify({cases:cases.length,failures:failures.length,pageErrors:errors.length,httpWrites:writes.length}));}
 assert.equal(failures.length,0);assert.equal(errors.length,0);assert.equal(writes.length,0);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
