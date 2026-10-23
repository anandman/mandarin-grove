const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const contrast=(a,b)=>{const lum=h=>{const c=h.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};return(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1280,height:900},colorScheme:'dark'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.APP_URL||'http://127.0.0.1:4192');
 await page.evaluate(()=>{PR={cur:'ux',list:[{id:'ux',name:'Synthetic',gr:'2',av:'🐼'}]};savePR();loadS();S=blank();S.cfg.set=['十','一','二','三'];save();setCards();say=()=>{};home();window.guides=[];const create=HanziWriter.create;HanziWriter.create=function(...args){const w=create.apply(this,args);guides.push(w);return w;};});
 const begin=async mode=>page.evaluate(mode=>{home();const c=ALL.find(x=>x.c==='十');startStudyRound('review',{units:[],chars:['十'],modes:[mode],limit:5},[c],[[mode,c]])},mode);
 // All recall surfaces: global rewards must not name the target, even after hdr/save.
 for(const mode of ['memory','listen','dictation']){
  await begin(mode);await page.evaluate(()=>hdr());
  assert.equal(await page.locator('#reward-strip').innerText().then(t=>t.includes('十')),false,mode+': rewards leak the target');
  assert.equal((await page.locator('header').ariaSnapshot()).includes('十'),false);
 }
 await begin('trace');await page.waitForFunction(()=>writer?._quiz);
 const palette=()=>page.locator('#hw').evaluate(el=>{const s=getComputedStyle(el);return {paper:s.getPropertyValue('--paper').trim(),ink:writer._options.strokeColor,outline:writer._options.outlineColor,drawing:writer._options.drawingColor};});
 let colors=await palette();assert.ok(contrast(colors.paper,colors.ink)>=4.5,'Completed dark strokes contrast with paper');assert.ok(contrast(colors.paper,colors.drawing)>=4.5,'Live ink contrasts');assert.ok(contrast(colors.paper,colors.outline)>=3,'Trace outline is visible');assert.notEqual(colors.paper.toUpperCase(),'#FFFDF5','Dark paper follows the theme');
 const drawStroke=async index=>{
  const coords=await page.evaluate(index=>{const e=document.getElementById('hw'),r=e.getBoundingClientRect(),w=writer.target.node.getAttribute('width'),t=HanziWriter.getScalingTransform(+w,+w,22);return STROKES['十'].medians[index].map(([x,y])=>[r.left+t.x+x*t.scale,r.top+(+w-t.y)-y*t.scale]);},index);
  await page.mouse.move(...coords[0]);await page.mouse.down();for(const p of coords.slice(1))await page.mouse.move(...p,{steps:4});await page.mouse.up();
 };
 await drawStroke(0);await page.waitForFunction(()=>writer._quiz._currentStrokeIndex===1);
 const before=await page.evaluate(()=>({round:JSON.stringify(SESS.round),stars:S.stars,guide:guides.length}));
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>Math.abs(+document.querySelector('#hw svg').getAttribute('width')-document.getElementById('hw').clientWidth)<1);
 assert.equal(await page.evaluate(()=>writer._quiz._currentStrokeIndex),1,'Resize retains accepted stroke');
 assert.equal(await page.getByRole('button',{name:'Mandarin Grove, Home',exact:true}).isVisible(),true,'Phone retains the clickable logo away from Home');
 await page.evaluate(()=>setAppearance('light'));await page.waitForTimeout(50);colors=await palette();assert.ok(contrast(colors.paper,colors.ink)>=4.5);assert.ok(contrast(colors.paper,colors.outline)>=3);
 assert.deepEqual(await page.evaluate(()=>({round:JSON.stringify(SESS.round),stars:S.stars,guide:guides.length})),before,'Appearance and resize do not recreate a question or alter progress');
 await drawStroke(1);await page.waitForFunction(()=>S.studyHistory.length===1);assert.equal(await page.evaluate(()=>S.studyHistory[0].score.correct),1,'Pointer alignment still completes the active quiz');
 await page.evaluate(()=>setAppearance('dark'));await page.setViewportSize({width:820,height:1060});await page.waitForTimeout(80);colors=await palette();assert.ok(contrast(colors.paper,colors.ink)>=4.5);
 assert.equal(await page.evaluate(()=>S.studyHistory.length),1,'Completed resize cannot duplicate results');
 // Real freehand pixels survive theme switches and are rendered with a matching checked preview.
 await begin('dictation');const canvas=page.locator('#dc');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();await page.mouse.move(box.x+130,box.y+130,{steps:8});await page.mouse.up();
 const bitmap=await canvas.evaluate(c=>c.toDataURL());const ink=await canvas.evaluate(c=>Array.from(c.getContext('2d').getImageData(100,100,1,1).data));assert.ok(ink[3]>0,'Actual ink recorded');
 const filter=await canvas.evaluate(c=>getComputedStyle(c).filter);assert.notEqual(filter,'none','Dark freehand visibly maps canonical ink to light ink');
 await page.evaluate(()=>setAppearance('light'));assert.equal(await canvas.evaluate(c=>c.toDataURL()),bitmap);await page.evaluate(()=>setAppearance('dark'));await page.locator('#dchk').click();
 assert.equal(await page.getByAltText('Your handwriting').evaluate(c=>getComputedStyle(c).filter),filter,'Checked preview matches live ink');assert.equal(await page.getByAltText('Your handwriting').getAttribute('src'),bitmap);
 // Keyboard Home saves a resumable round; its visible cue does not add a second control.
 const logo=page.getByRole('button',{name:'Mandarin Grove, Home',exact:true});assert.ok(await page.locator('#home').isVisible());await logo.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('body').getAttribute('data-screen'),'home');assert.equal(await page.locator('#home').isVisible(),false);assert.ok(await page.evaluate(()=>currentStudyRound('review')));
 for(const width of [390,820,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 assert.deepEqual(errors,[]);console.log('PASS: whole-page answer concealment, live/completed paper contrast, active resize/pointer alignment, preserved ink/theme and Home keyboard/resume.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
