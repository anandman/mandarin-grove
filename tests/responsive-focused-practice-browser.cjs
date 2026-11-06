/* Focus must free practice space without replacing live work or hiding actions. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {scaleNativeTextStyles}=require('../scripts/native-text-style.cjs');
// Removing the constrained-layout adaptation must fail these rendered bounds;
// changing its class name or implementation must not affect the expectations.
const fixtures=process.env.GROVE_FOCUS_FIXTURES?JSON.parse(process.env.GROVE_FOCUS_FIXTURES):[
 {width:320,height:568,scale:1.5,focused:true,top:0,bottom:0},
 {width:360,height:640,scale:1.5,focused:true,top:24,bottom:16},
 {width:568,height:320,scale:1.5,focused:true,top:0,bottom:21},
 {width:320,height:568,scale:1,focused:false,top:0,bottom:0},
 {width:390,height:844,scale:1.5,focused:false,top:47,bottom:34},
 {width:820,height:1180,scale:1.5,focused:false,top:24,bottom:20},
 {width:390,height:844,scale:2,focused:true,top:47,bottom:34},
 {width:320,height:568,scale:1.25,focused:true,top:0,bottom:0}
];
const modes=['trace','memory','listen','flip','dictation','words','summary'];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 const cases=[],failures=[],errors=[],writes=[];let complete=false;
 try{
  const url=process.env.APP_URL||'http://127.0.0.1:4173',context=await browser.newContext();
  await context.route('**/*',route=>{const r=route.request();if(!['GET','HEAD','OPTIONS'].includes(r.method())){writes.push(r.method());return route.abort();}if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(url).origin)return route.abort();return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.evaluate(()=>GROVE_STARTED);
  await page.evaluate(async()=>{PR={cur:'focus-qa',list:[{id:'focus-qa',name:'Focus QA',gr:'2',av:'🐼'}],futureFocus:{keep:['unknown']}};await savePR();S=blank();S.cfg.set=['学'];S.futureFocus={keep:['unknown']};localStorage.setItem('zh_p_focus-qa',JSON.stringify(S));await loadS();window.say=()=>{};await home();});
  for(const file of ['styles.css','theme.css','mistakes.css','app-layout.css'])await page.addStyleTag({content:scaleNativeTextStyles(fs.readFileSync(path.join(__dirname,'..',file),'utf8'))});
  const profileStyle=page.locator('#profile-ui-style');await profileStyle.evaluate((el,s)=>el.textContent=s,scaleNativeTextStyles(await profileStyle.textContent()));
  async function settled(){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
  async function shell(){return page.evaluate(()=>Object.fromEntries(['header','#reward-strip','footer'].map(s=>[s,document.querySelector('body > '+s).getBoundingClientRect().height])));}
  async function check(fixture,mode,phase){
   await settled();
   const geometry=await page.evaluate(f=>{
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const visible=e=>e.checkVisibility()&&!e.closest('[hidden]');
    const controls=[...new Set(document.querySelectorAll('#page-back,.study-sessionbar button,.activity-frame button,.activity-frame summary,#word-practice button,#summary-help button,#summary-help textarea,.study-finish button'))].filter(visible).map(e=>{
     const r=rect(e),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),clipped=[];
     for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),pr=p.getBoundingClientRect();if(/auto|hidden|scroll|clip/.test(s.overflowY)&&(r.y<pr.top-1||r.bottom>pr.bottom+1))clipped.push({name:p.id||p.className,rect:rect(p)});}
     return{label:e.getAttribute('aria-label')||e.textContent.trim()||e.id,...r,inside:r.x>=-1&&r.right<=f.width+1&&r.y>=f.top-1&&r.bottom<=f.height-f.bottom+1,hit:e.disabled||hit===e||e.contains(hit),hitElement:hit?{tag:hit.tagName,id:hit.id,class:hit.className?.baseVal??hit.className,text:hit.textContent.slice(0,90)}:null,clipped};
    });
    const paper=document.querySelector('#hw,#dc'),main=document.querySelector('#app'),obscuredTitles=[];
    for(const h of main.querySelectorAll('h1'))if(visible(h)){
     const range=document.createRange();range.selectNodeContents(h);
     for(const r of range.getClientRects())if(r.width>4&&r.height>4)for(const x of [r.left+2,r.right-2]){const hit=document.elementFromPoint(x,r.top+r.height/2);if(hit!==h&&!h.contains(hit))obscuredTitles.push({text:h.textContent,hit:hit?.id||hit?.tagName});}
    }
    return{controls,paper:paper&&visible(paper)?rect(paper):null,obscuredTitles,bodyText:getComputedStyle(document.body).fontSize,mainScroll:main.scrollHeight-main.clientHeight};
   },fixture);
   for(const control of geometry.controls)if(!control.inside||!control.hit||control.clipped.length||control.width<43.5||control.height<43.5)failures.push({fixture,mode,phase,issue:'Action or input is clipped, obscured or smaller than44px',control});
   if(geometry.paper){const minimum=fixture.height<400?100:160;if(geometry.paper.width<minimum||geometry.paper.height<minimum||Math.abs(geometry.paper.width-geometry.paper.height)>1)failures.push({fixture,mode,phase,issue:'Writing must remain a usable square',paper:geometry.paper,minimum});}
   if(geometry.mainScroll>1)failures.push({fixture,mode,phase,issue:'Task requires scrolling',mainScroll:geometry.mainScroll});
   if(geometry.obscuredTitles.length)failures.push({fixture,mode,phase,issue:'Task title is obscured',titles:geometry.obscuredTitles});
   assert.equal(geometry.bodyText,fixture.scale===1?'16px':fixture.scale===2?'32px':fixture.scale===1.25?'20px':'24px','Accessibility text remains enlarged');
   return geometry;
  }
  for(const fixture of fixtures)for(const mode of modes){
   await page.setViewportSize({width:fixture.width,height:fixture.height});
   await page.evaluate(async f=>{document.documentElement.style.setProperty('--grove-text-scale',String(f.scale));for(const [edge,value]of Object.entries({top:f.top,right:0,bottom:f.bottom,left:0}))document.documentElement.style.setProperty('--safe-area-inset-'+edge,value+'px');await home();},fixture);
   await page.evaluate(async mode=>{if(mode==='summary'){showSummaryHelp();return;}const c=ALL.find(c=>c.c==='学');await startStudyRound('practice',{units:[],chars:['学'],modes:[mode],limit:5},[c],[[mode,c]]);},mode);
   if(['trace','memory'].includes(mode))await page.waitForFunction(()=>writer?._quiz&&document.querySelectorAll('#hw path').length>0);
   if(mode==='dictation')await page.waitForSelector('#dc');
   if(mode==='words')await page.waitForSelector('#word-check:not([disabled])');
   await settled();
   const seenShell=await shell();for(const [name,height]of Object.entries(seenShell))if(fixture.focused?height!==0:height===0&&(name!=='#reward-strip'||mode==='summary'))failures.push({fixture,mode,issue:fixture.focused?'Repeated shell consumes focused task space':'Ordinary task navigation disappeared',name,height});
   if(mode!=='summary')assert(await page.getByRole('button',{name:'Pause',exact:true}).isVisible(),'Actual study Pause remains available');
   const geometry=[await check(fixture,mode,'initial')];
   if(mode==='dictation'){
    const paper=await page.locator('#dc').boundingBox(),beforeInk=await page.locator('#dc').evaluate(e=>e.toDataURL());
    await page.mouse.move(paper.x+paper.width*.2,paper.y+paper.height*.3);await page.mouse.down();await page.mouse.move(paper.x+paper.width*.8,paper.y+paper.height*.3,{steps:10});await page.mouse.up();
    assert.notEqual(await page.locator('#dc').evaluate(e=>e.toDataURL()),beforeInk,'Real pointer input must produce ink');
   }
   if(mode==='flip'){await page.locator('#cd').click();geometry.push(await check(fixture,mode,'revealed'));}
   if(mode==='words'){
    await page.locator('#word-input').fill('学校');await page.locator('#word-check').click();
    await page.waitForSelector('#word-study-next:not([hidden])');geometry.push(await check(fixture,mode,'checked'));
    for(const selector of ['.word-seed-information','.word-practice-extra']){
     const region=page.locator(selector),overflows=await region.evaluate(e=>e.scrollHeight>e.clientHeight+1&&e.getClientRects().length>0);
     if(overflows){
      if(await region.evaluate(e=>e.tabIndex)<0)failures.push({fixture,mode,issue:'Scrollable word information must be keyboard reachable',selector});
      else{await region.focus();await page.keyboard.press('ArrowDown');await page.waitForFunction(s=>document.querySelector(s).scrollTop>0,selector,{timeout:2000});}
     }
    }
   }
   if(mode==='dictation'){
    await page.getByRole('button',{name:'Next: Pinyin',exact:true}).click();geometry.push(await check(fixture,mode,'pinyin'));
    await page.locator('[data-t]').first().click();await page.locator('[data-tn="2"]').click();
    await page.locator('.dictation-workspace .compact-step-navigation').getByRole('button',{name:'Back',exact:true}).click();geometry.push(await check(fixture,mode,'write again'));
   }
   if(mode==='summary'){
    const field=page.locator('#summary-help textarea:visible').first();await field.fill('Preserve this unfinished idea');
    for(const label of ['Key details','My summary']){await page.getByRole('button',{name:'Next: '+label,exact:true}).click();geometry.push(await check(fixture,mode,label));}
   }
   await page.evaluate(async()=>{const canvas=document.getElementById('dc');window.focusKept={frame:document.querySelector('.activity-frame,#summary-help,#word-practice'),writer:writer,quiz:writer?._quiz,session:SESS,canvas,ink:canvas?.toDataURL(),pinyin:document.getElementById('pyout')?.textContent,inputs:[...document.querySelectorAll('#app input,#app textarea')].map(e=>[e,e.value,e.selectionStart,e.selectionEnd]),backup:await backup()};});
   await page.setViewportSize({width:820,height:1180});await settled();
   const expandedShell=await shell();assert(expandedShell.header>0&&expandedShell.footer>0&&(mode!=='summary'||expandedShell['#reward-strip']>0),'Expanding a task restores ordinary navigation: '+JSON.stringify(expandedShell));
   assert(await page.evaluate(async()=>{const k=focusKept;return document.querySelector('.activity-frame,#summary-help,#word-practice')===k.frame&&writer===k.writer&&writer?._quiz===k.quiz&&SESS===k.session&&k.inputs.every(([e,v,start,end])=>e.isConnected&&e.value===v&&e.selectionStart===start&&e.selectionEnd===end)&&await backup()===k.backup;}),'Resize retains the same task, writer, quiz, inputs and exact save');
   assert(await page.evaluate(()=>!focusKept.canvas||document.getElementById('dc')===focusKept.canvas&&focusKept.canvas.toDataURL()===focusKept.ink&&document.getElementById('pyout').textContent===focusKept.pinyin),'Actual ink and selected pinyin survive focused-to-ordinary reflow');
   await page.setViewportSize({width:fixture.width,height:fixture.height});await settled();
   assert(await page.evaluate(async()=>await backup()===focusKept.backup),'Returning to the small view leaves saves exact');
   if(fixture.focused){
    await page.evaluate(()=>document.documentElement.style.setProperty('--grove-text-scale','1'));await settled();
    const normalTextShell=await shell();if(normalTextShell.header===0||!await page.getByRole('button',{name:'Report a problem',exact:true}).isVisible())failures.push({fixture,mode,issue:'Returning to ordinary text must restore navigation without resizing',shell:normalTextShell});
    await page.evaluate(scale=>document.documentElement.style.setProperty('--grove-text-scale',String(scale)),fixture.scale);await settled();
    const largeTextShell=await shell();if(largeTextShell.header!==0||largeTextShell.footer!==0)failures.push({fixture,mode,issue:'Enlarging text must restore focus without resizing',shell:largeTextShell});
    assert(await page.evaluate(async()=>await backup()===focusKept.backup),'Text-size changes preserve the exact save');
   }
   if(process.env.GROVE_FOCUS_SCREENSHOTS&&fixture.width===320&&fixture.scale===1.5){fs.mkdirSync(process.env.GROVE_FOCUS_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.GROVE_FOCUS_SCREENSHOTS,mode+'.png')});}
   if(mode!=='summary'){
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    if(mode==='words'){
     await page.waitForSelector('.study-finish');geometry.push(await check(fixture,mode,'round complete'));
     await page.getByRole('button',{name:'Finish',exact:true}).click();
    }
   }else{
    await page.locator('#page-back').click();await page.waitForFunction(()=>document.body.dataset.layout==='content');await settled();
    assert((await shell()).header>0,'Summary Back returns to Help with navigation');await page.evaluate(()=>home());
   }
   await page.waitForFunction(()=>document.body.dataset.layout==='home');await settled();
   const homeShell=await shell();assert(homeShell.header>0&&homeShell['#reward-strip']>0&&await page.getByRole('button',{name:'Report a problem',exact:true}).isVisible(),'Home restores header, rewards and report access');
   assert(await page.locator('#gear').isVisible(),'Grown-ups remains available on Home');
   cases.push({fixture,mode,shell:seenShell,geometry});
  }
  await page.setViewportSize({width:320,height:568});await page.evaluate(()=>document.documentElement.style.setProperty('--grove-text-scale','1.5'));
  await page.evaluate(async()=>grown('backup'));await settled();assert(await page.locator('#grest').isVisible(),'Backup access survives focused practice');
  await page.evaluate(()=>{profileClose(document.querySelector('dialog[open]'));setup(false);});await settled();
  assert((await shell()).header>0,'Onboarding keeps its navigation');
  complete=true;
 }finally{
  await browser.close();const report={complete,cases,failures,pageErrors:errors,httpWrites:writes};
  if(process.env.GROVE_FOCUS_REPORT)fs.writeFileSync(process.env.GROVE_FOCUS_REPORT,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({complete,cases:cases.length,failures:failures.length,pageErrors:errors.length,httpWrites:writes.length}));
  if(!complete||cases.length!==fixtures.length*modes.length||failures.length||errors.length||writes.length)process.exitCode=1;
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
