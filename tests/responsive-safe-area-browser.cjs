/* Native system-bar values are supplied through Capacitor's documented CSS variables. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const fixtures=[
 {viewport:{width:360,height:720},insets:{top:48,right:0,bottom:24,left:0}},
 {viewport:{width:844,height:390},insets:{top:0,right:59,bottom:21,left:59}},
 {viewport:{width:820,height:1180},insets:{top:32,right:0,bottom:20,left:0}}
];
(async()=>{
 const origin=process.env.APP_URL||'http://127.0.0.1:4173';
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 const cases=[],failures=[],errors=[],writes=[];let complete=false;
 try{
  const context=await browser.newContext();
  await context.route('**/*',route=>{
   const request=route.request();
   if(!['GET','HEAD','OPTIONS'].includes(request.method())){writes.push(request.method()+' '+request.url());return route.abort();}
   if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==new URL(origin).origin)return route.abort();
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.evaluate(()=>GROVE_STARTED);
  await page.evaluate(async()=>{
   PR={cur:'synthetic-safe-area',list:[{id:'synthetic-safe-area',name:'Insets_QA',gr:'2',av:'🐼'}]};
   await savePR();S=blank();S.cfg.set=['学'];localStorage.setItem('zh_p_synthetic-safe-area',JSON.stringify(S));await loadS();window.say=()=>{};await home();
  });
  async function check(screen,selector,fixture){
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const rows=await page.locator(selector).evaluateAll((els,{viewport,insets})=>els.map(el=>{
    const r=el.getBoundingClientRect();
    return {label:el.getAttribute('aria-label')||el.textContent.trim().slice(0,45),box:{x:r.x,y:r.y,width:r.width,height:r.height},
     insideSafeArea:r.left>=insets.left-1&&r.top>=insets.top-1&&r.right<=viewport.width-insets.right+1&&r.bottom<=viewport.height-insets.bottom+1,
     usable:r.width>=43.5&&r.height>=43.5};
   }),fixture);
   if(!rows.length)failures.push({screen,fixture,reason:'No visible controls; not a qualified case'});
   for(const row of rows)if(!row.insideSafeArea||!row.usable)failures.push({screen,fixture,...row});
   cases.push({screen,fixture,controls:rows});
  }
  for(const fixture of fixtures){
   await page.setViewportSize(fixture.viewport);
   await page.evaluate(insets=>{
    for(const [edge,value]of Object.entries(insets))document.documentElement.style.setProperty('--safe-area-inset-'+edge,value+'px');
    window.dispatchEvent(new Event('resize'));
   },fixture.insets);
   await page.evaluate(()=>home());await check('Home header','body > header button:visible',fixture);
   await page.evaluate(()=>grown('backup'));await check('Grown-ups Backup','dialog[open] button:visible',fixture);
   await page.locator('dialog[open] button[aria-label="Close"]').click();
   await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
   await page.evaluate(async()=>{await home();await trace();});
   await page.waitForSelector('#hw svg',{state:'attached',timeout:12000});
   await check('Trace navigation and actions','#page-navigation button:visible, #app button:visible',fixture);
   await page.evaluate(async()=>{await home();showFeedback({category:'broken',note:'Synthetic safe-area check; never send'});});
   await check('Feedback controls','dialog[open] button:visible',fixture);
   await page.evaluate(()=>{for(const dialog of document.querySelectorAll('dialog[open]'))profileClose(dialog);});
  }
  complete=true;
 }finally{
  await browser.close();
  const report={complete,cases,failures,pageErrors:errors,unexpectedWrites:writes};
  if(process.env.GROVE_SAFE_AREA_REPORT)fs.writeFileSync(process.env.GROVE_SAFE_AREA_REPORT,JSON.stringify(report,null,2));
  console.log(JSON.stringify({cases:cases.length,failures:failures.length,pageErrors:errors.length,unexpectedWrites:writes.length,examples:failures.slice(0,3)}));
  if(!complete||cases.length!==12||failures.length||errors.length||writes.length)process.exitCode=1;
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
