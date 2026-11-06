/* Real rendered bounds: visibility alone does not mean a control is on screen. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const viewports=process.env.GROVE_LAYOUT_VIEWPORTS?JSON.parse(process.env.GROVE_LAYOUT_VIEWPORTS):[
 {width:320,height:568},{width:360,height:640},{width:390,height:844},
 {width:412,height:800},{width:820,height:1180},{width:1180,height:820},
 {width:1365,height:768},{width:1440,height:900},{width:844,height:390}
];
const tasks={
 onboarding:async()=>setup(false),
 profiles:async()=>who(),
 home:async()=>home(),
 listen:async()=>listen(ALL.find(c=>c.c==='学')),
 trace:async()=>trace(),
 memory:async()=>memory(ALL.find(c=>c.c==='学')),
 studyTrace:async()=>{
  showStudySetup('practice',[ALL.find(c=>c.c==='学')]);
  for(const input of document.querySelectorAll('#study-setup [data-study-mode]')){
   input.checked=input.dataset.studyMode==='trace';input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  document.getElementById('study-start').click();
  // A preceding viewport can leave this synthetic round paused. Exercise
  // the existing explicit replacement confirmation, rather than waiting on
  // an activity that the app correctly has not opened yet.
  if(!document.getElementById('study-replace')?.hidden)document.getElementById('study-confirm-replace').click();
 },
 studyDictation:async()=>{const c=ALL.find(c=>c.c==='学');await startStudyRound('practice',{units:[],chars:['学'],modes:['dictation'],limit:5},[c],[['dictation',c]]);},
 studyWords:async()=>{const c=ALL.find(c=>c.c==='学');await startStudyRound('practice',{units:[],chars:['学'],modes:['words'],limit:5},[c],[['words',c]]);},
 flip:async()=>flip(ALL.find(c=>c.c==='学')),
 flipRevealed:async()=>{flip(ALL.find(c=>c.c==='学'));document.getElementById('cd').click();},
 dictation:async()=>dictStart('学校'),
 dictationResult:async()=>{await dictStart('学校');document.getElementById('dchk').click();},
 dictationDone:async()=>dictStart(''),
 words:async()=>showWordPractice([ALL.find(c=>c.c==='学')]),
 writing:async()=>showWritingIdeas(),
 summary:async()=>showSummaryHelp()
};
const dialogs={
 practiceSetup:async()=>showStudySetup('practice'),
 reviewSetup:async()=>showStudySetup('review'),
 appearance:async()=>showAppearance(),
 feedback:async()=>showFeedback({category:'broken',note:'Synthetic viewport test; do not send'})
};
const information={
 help:async()=>showHomeworkHelp(),progress:async()=>kidProgress(),
 grove:async()=>showGroveRewards(),characters:async()=>cat(),
 lookup:async()=>showHomeworkLookup(),readings:async()=>showOnlineLibrary(),
 history:async()=>pastQ(),badges:async()=>rewardCollection(),
 dashboard:async()=>parentDashboard()
};
const contentDialog={mistakes:async()=>showRecentMistakes()};
const settings={
 settingsChild:async()=>grown('child'),settingsBackup:async()=>grown('backup'),
 restorePreview:async()=>{await grown('backup');document.getElementById('grest').click();const field=document.getElementById('grt');field.value=await backup();await field.oninput();}
};
(async()=>{
 const origin=process.env.APP_URL||'http://127.0.0.1:4173';
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 const failures=[],cases=[],errors=[],writes=[];
 const writeReport=complete=>{if(process.env.GROVE_LAYOUT_REPORT)fs.writeFileSync(process.env.GROVE_LAYOUT_REPORT,JSON.stringify({complete,cases,failures,pageErrors:errors,unexpectedWrites:writes},null,2));};
 try{
  const context=await browser.newContext();
  await context.route('**/*',route=>{
   const r=route.request();
   if(!['GET','HEAD','OPTIONS'].includes(r.method())){writes.push(r.method()+' '+r.url());return route.abort();}
   if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(origin).origin)return route.abort();
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.evaluate(()=>GROVE_STARTED);
  await page.evaluate(async()=>{
   PR={cur:'synthetic-layout',list:[{id:'synthetic-layout',name:'Viewport learner',gr:'2',av:'🐼'}],futureLayoutFixture:{keep:true}};
   await savePR();S=blank();S.cfg.set=['学','校','狗','猫'];S.cfg.quiz=QU('2')[0][1];S.futureField={keep:['original']};
   localStorage.setItem('zh_p_synthetic-layout',JSON.stringify(S));await loadS();window.say=()=>{};await home();
  });
  if(process.env.GROVE_LAYOUT_TEXT_SCALE){
   // Render the same authored declarations that export-mobile scales. This
   // qualifies browser layout under native text CSS, not an OS runtime test.
   const {scaleNativeTextStyles}=require('../scripts/native-text-style.cjs');
   for(const file of ['styles.css','theme.css','mistakes.css','app-layout.css'])await page.addStyleTag({content:scaleNativeTextStyles(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'))});
   const inline=page.locator('#profile-ui-style');if(await inline.count())await inline.evaluate((el,text)=>el.textContent=text,scaleNativeTextStyles(await inline.textContent()));
   await page.evaluate(scale=>document.documentElement.style.setProperty('--grove-text-scale',scale),process.env.GROVE_LAYOUT_TEXT_SCALE);
  }
  async function controlChecks(locator,screen,viewport,group){
   const rows=await locator.evaluateAll(els=>els.map(el=>{
    const r=el.getBoundingClientRect(),v=visualViewport;
    const bounds={left:v?.offsetLeft||0,top:v?.offsetTop||0,width:v?.width||innerWidth,height:v?.height||innerHeight};
    const inView=r.left>=bounds.left-1&&r.top>=bounds.top-1&&r.right<=bounds.left+bounds.width+1&&r.bottom<=bounds.top+bounds.height+1;
    const hit=inView?document.elementFromPoint(r.left+r.width/2,r.top+r.height/2):null;
    return {label:el.getAttribute('aria-label')||el.textContent.trim().slice(0,70)||el.id,
     box:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom},inView,
     unobscured:!!hit&&(el===hit||el.contains(hit)),usable:r.width>=43.5&&r.height>=43.5};
   }));
   for(const r of rows)if(!r.inView||!r.unobscured||!r.usable)failures.push({screen,viewport,group,...r});
   return rows.length;
  }
  for(const viewport of viewports){
   await page.setViewportSize(viewport);
   for(const [family,entries]of Object.entries({task:tasks,dialog:dialogs,settings,information,contentDialog})){
    for(const [screen,show]of Object.entries(entries)){
     try{
      await page.evaluate(async()=>{for(let pass=0;pass<8;pass++){const d=[...document.querySelectorAll('dialog[open]')].at(-1);if(!d)break;if(d.id==='study-setup')closeStudySetup();else profileClose(d);await new Promise(r=>setTimeout(r,0));}if(document.querySelector('dialog[open]'))throw Error('Synthetic case cleanup left an open modal');await home();});
      await page.evaluate('('+show.toString()+')()');
      if(screen==='studyTrace')await page.waitForFunction(()=>SESS?.study&&document.querySelector('#hw'),null,{timeout:12000});
      if(['trace','memory','studyTrace'].includes(screen)){
       await page.waitForSelector('#hw svg',{state:'attached',timeout:12000});
       // Stroke clip paths are deliberately not painted. Waiting for the first
       // path to be visible would mistake those definitions for a load failure.
       await page.waitForFunction(()=>document.querySelectorAll('#hw svg path').length>0,null,{timeout:12000});
       const paper=await page.locator('#hw').boundingBox();
       const minimum=viewport.height<640?160:200;
       if(!paper||paper.width<minimum||paper.height<minimum||Math.abs(paper.width-paper.height)>1)failures.push({screen,viewport,group:'usable square handwriting area',box:paper,minimum});
      }
      if(['words','studyWords'].includes(screen))await page.waitForSelector('#word-check:not([disabled])',{timeout:12000});
      if(screen==='dictationResult')await page.waitForSelector('#cy',{timeout:12000});
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const escaped=await page.evaluate(()=>{
       if(document.body.dataset.layout!=='task')return [];
       return [...document.querySelectorAll('#app, .activity-frame, .activity-frame-workspace')].filter(el=>el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2).map(el=>({id:el.id,class:el.className,client:[el.clientWidth,el.clientHeight],content:[el.scrollWidth,el.scrollHeight]}));
      });
      if(escaped.length)failures.push({screen,viewport,group:'unintended task scrolling or clipping',escaped});
      if(['dictation','studyDictation'].includes(screen)){
       const paper=await page.locator('#dc').boundingBox(),minimum=viewport.height<640?160:200;
       if(!paper||paper.width<minimum||paper.height<minimum||Math.abs(paper.width-paper.height)>1)failures.push({screen,viewport,group:'usable dictation canvas',box:paper,minimum});
      }
      const scope=['dialog','settings','contentDialog'].includes(family)?page.locator('dialog[open]').last():page.locator('#app');
      let count=0;
      if(['task','dialog','contentDialog'].includes(family))count+=await controlChecks(scope.getByRole('button'),screen,viewport,'screen actions');
      // Visit every pane; hidden future controls must not get a free pass.
      if(['dictation','studyDictation','summary','onboarding'].includes(screen)){
       const steps=scope.locator('.compact-step-navigation:visible');
       if(await steps.count()){
        for(let step=1;step<(screen==='summary'?3:2);step++){
         await steps.getByRole('button',{name:/^Next:/}).click();
         count+=await controlChecks(scope.getByRole('button'),screen+' step '+(step+1),viewport,'step actions');
        }
       }
      }
      if(family==='settings'){
       count+=await controlChecks(scope.locator(':scope > header').getByRole('button'),screen,viewport,'settings navigation');
       count+=await controlChecks(scope.locator('.settings-actions').getByRole('button'),screen,viewport,'settings commit');
       if(screen!=='settingsChild')count+=await controlChecks(scope.locator('.settings-content').getByRole('button'),screen,viewport,'backup actions');
       await scope.locator('.settings-content').evaluate(e=>e.scrollTop=e.scrollHeight);
       count+=await controlChecks(scope.locator(':scope > header').getByRole('button'),screen,viewport,'settings navigation after scroll');
       count+=await controlChecks(scope.locator('.settings-actions').getByRole('button'),screen,viewport,'settings commit after scroll');
      }
      if(!['dialog','settings','contentDialog'].includes(family)){
       count+=await controlChecks(page.locator('header').getByRole('button'),screen,viewport,'app header');
       count+=await controlChecks(page.locator('#reward-strip').getByRole('button'),screen,viewport,'reward navigation');
       count+=await controlChecks(page.locator('#page-navigation').getByRole('button'),screen,viewport,'navigation');
       count+=await controlChecks(page.getByRole('button',{name:'Report a problem',exact:true}),screen,viewport,'app footer');
      }
      if(family==='information'){
       await page.evaluate(()=>{const main=document.getElementById('app');if(main.scrollHeight>main.clientHeight+2&&/auto|scroll/.test(getComputedStyle(main).overflowY))main.scrollTop=main.scrollHeight;else window.scrollTo(0,document.documentElement.scrollHeight);});
       count+=await controlChecks(page.locator('#page-navigation').getByRole('button'),screen,viewport,'navigation after content scroll');
      }
      cases.push({screen,family,viewport,controlsChecked:count});
      if(process.env.GROVE_LAYOUT_SCREENSHOTS&&['home','trace','studyTrace','dictation','studyDictation','studyWords','dictationResult','summary','settingsBackup','restorePreview','feedback'].includes(screen)){
       fs.mkdirSync(process.env.GROVE_LAYOUT_SCREENSHOTS,{recursive:true});
       await page.screenshot({path:require('node:path').join(process.env.GROVE_LAYOUT_SCREENSHOTS,`${viewport.width}x${viewport.height}-${screen}.png`)});
      }
     }catch(e){failures.push({screen,family,viewport,error:e.message});}
     writeReport(false);
    }
   }
  }
  if(errors.length)failures.push({pageErrors:errors});if(writes.length)failures.push({unexpectedWrites:writes});
  writeReport(true);
  console.log(JSON.stringify({cases:cases.length,failures:failures.length,pageErrors:errors.length,unexpectedWrites:writes.length,examples:failures.slice(0,6)}));
  if(failures.length)throw Error('Primary controls must fit the visible viewport with usable, unobscured targets.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1)});
