/* The memory question's reading and meaning must be visible without scrolling. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const ordinaryFixtures=[{width:360,height:800,insets:{top:58,right:0,bottom:21,left:0}},{width:320,height:568,insets:{top:0,right:0,bottom:0,left:0}},{width:844,height:390,insets:{top:0,right:59,bottom:21,left:59}},{width:820,height:1180,insets:{top:32,right:0,bottom:20,left:0}}];
const scenarios=process.env.GROVE_MEMORY_CUE_TEXT_SCALE?[{textScale:Number(process.env.GROVE_MEMORY_CUE_TEXT_SCALE),fixtures:process.env.GROVE_MEMORY_CUE_FIXTURES?JSON.parse(process.env.GROVE_MEMORY_CUE_FIXTURES):ordinaryFixtures}]:[
 {textScale:1,fixtures:ordinaryFixtures},
 {textScale:1.5,fixtures:[{width:390,height:844,insets:{top:54,right:0,bottom:21,left:0}},{width:820,height:1180,insets:{top:32,right:0,bottom:20,left:0}}]}
];
const cardKeys=['二','种','长'];
const expectedCases=scenarios.reduce((sum,s)=>sum+s.fixtures.length*2*cardKeys.length,0);
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH}),cases=[],failures=[],errors=[],writes=[];let complete=false;
 try{
  for(const scenario of scenarios){
  const fixtures=scenario.fixtures;
  const origin=process.env.APP_URL||'http://127.0.0.1:4173',context=await browser.newContext();
  await context.route('**/*',route=>{const r=route.request();if(!['GET','HEAD','OPTIONS'].includes(r.method())){writes.push(r.method());return route.abort();}if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(origin).origin)return route.abort();return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.evaluate(()=>GROVE_STARTED);
  await page.evaluate(async()=>{PR={cur:'memory-cue-qa',list:[{id:'memory-cue-qa',name:'Cue QA',gr:'K',av:'🐼'}]};await savePR();S=blank();S.cfg.set=['二'];localStorage.setItem('zh_p_memory-cue-qa',JSON.stringify(S));await loadS();window.say=()=>{};await home();});
  if(scenario.textScale!==1){
   const {scaleNativeTextStyles}=require('../scripts/native-text-style.cjs');
   for(const file of ['styles.css','theme.css','mistakes.css','app-layout.css'])await page.addStyleTag({content:scaleNativeTextStyles(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'))});
   const style=page.locator('#profile-ui-style');await style.evaluate((el,text)=>el.textContent=text,scaleNativeTextStyles(await style.textContent()));
   await page.evaluate(scale=>document.documentElement.style.setProperty('--grove-text-scale',scale),String(scenario.textScale));
  }
  for(const fixture of fixtures)for(const study of [false,true])for(const cardKey of cardKeys){
   await page.setViewportSize({width:fixture.width,height:fixture.height});
   await page.evaluate(async({fixture,study,cardKey})=>{for(const [edge,n]of Object.entries(fixture.insets))document.documentElement.style.setProperty('--safe-area-inset-'+edge,n+'px');await home();const c=ALL.find(c=>c.c===cardKey);if(study)await startStudyRound('practice',{units:[],chars:[cardKey],modes:['memory'],limit:5},[c],[['memory',c]]);else await memory(c);},{fixture,study,cardKey});
   await page.waitForFunction(()=>writer?._quiz&&document.querySelectorAll('#hw path').length>0);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   await page.evaluate(async()=>{window.keptCueWriter=writer;window.keptCueQuiz=writer._quiz;window.keptCueBackup=await backup();});
   const cues=await page.locator('.activity-frame-information .pin:visible,.activity-frame-information .mean:visible').evaluateAll((els,{fixture})=>els.map(el=>{
    const r=el.getBoundingClientRect(),row=document.querySelector('.activity-frame-information').getBoundingClientRect(),clipped=[];if(r.top<row.top-1||r.bottom>row.bottom+1)clipped.push({element:'allocated information row',edge:'vertical'});
    for(let p=el.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),pr=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflowY)&&(r.top<pr.top-1||r.bottom>pr.bottom+1))clipped.push({element:p.id||p.className,edge:'vertical'});if(/auto|scroll|hidden|clip/.test(s.overflowX)&&(r.left<pr.left-1||r.right>pr.right+1))clipped.push({element:p.id||p.className,edge:'horizontal'});}
    return{text:el.textContent.trim(),box:{x:r.x,y:r.y,width:r.width,height:r.height},clipped,horizontalOverflow:el.scrollWidth>el.clientWidth+1,inside:r.top>=fixture.insets.top-1&&r.bottom<=fixture.height-fixture.insets.bottom+1&&r.left>=fixture.insets.left-1&&r.right<=fixture.width-fixture.insets.right+1};
   }),{fixture});
   if(cues.length!==2)failures.push({fixture,study,issue:'Both primary cues must be rendered'});
   for(const cue of cues)if(cue.clipped.length||!cue.inside||cue.horizontalOverflow)failures.push({fixture,study,card:cardKey,issue:'Primary question cue is clipped or requires horizontal scrolling',cue});
   const paper=await page.locator('#hw').boundingBox();if(paper.width<160||paper.height<160)failures.push({fixture,study,issue:'Handwriting area became unusable',paper});
   const help=page.locator('.activity-help > summary');await help.click();assert(await page.getByText('Write this from memory',{exact:true}).isVisible(),'Instruction remains available inline or in opened help');await help.click();
   assert(await page.evaluate(async()=>writer===keptCueWriter&&writer._quiz===keptCueQuiz&&await backup()===keptCueBackup),'Disclosure never recreates the writer or changes progress');
   const scrolls=[];
   for(const selector of ['.pin','.mean']){
    const reading=page.locator('.activity-frame-information '+selector+':visible');
    const needsScroll=await reading.evaluate(el=>el.scrollHeight>el.clientHeight+1);
    if(needsScroll){await reading.focus();await page.keyboard.press('ArrowDown');await page.waitForFunction(selector=>document.querySelector('.activity-frame-information '+selector).scrollTop>0,selector,{timeout:2000});scrolls.push(selector);}
   }
   assert(await page.evaluate(async()=>writer===keptCueWriter&&writer._quiz===keptCueQuiz&&await backup()===keptCueBackup),'Reading scroll never changes the writer or progress');
   cases.push({fixture,textScale:scenario.textScale,study,card:cardKey,cues,paper,verticalReadingScrollTested:scrolls});
  }
  await context.close();
  }
  complete=true;
 }finally{await browser.close();const report={complete,cases,failures,pageErrors:errors,unexpectedWrites:writes};if(process.env.GROVE_MEMORY_CUE_REPORT)fs.writeFileSync(process.env.GROVE_MEMORY_CUE_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify({complete,cases:cases.length,failures:failures.length,pageErrors:errors.length,unexpectedWrites:writes.length}));if(!complete||cases.length!==expectedCases||failures.length||errors.length||writes.length)process.exitCode=1;}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
