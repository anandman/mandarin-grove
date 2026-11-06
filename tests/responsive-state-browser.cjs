// Real input and node identity checks; all learners/data are disposable fixtures.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 try{
  const context=await browser.newContext({viewport:{width:360,height:640}}),errors=[],writes=[];
  const origin=process.env.APP_URL||'http://127.0.0.1:4173';
  await context.route('**/*',route=>{
   const r=route.request();
   if(!['GET','HEAD','OPTIONS'].includes(r.method())){writes.push(r.method());return route.abort();}
   if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(origin).origin)return route.abort();
   return route.continue();
  });
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(origin);await p.evaluate(()=>GROVE_STARTED);
  await p.evaluate(async()=>{
   PR={cur:'resize-synthetic',list:[{id:'resize-synthetic',name:'QA',av:'🐼',gr:'2'}],future:{retained:true}};await savePR();
   await loadS();S=blank();S.cfg.set=['学','校'];S.future={unknown:['preserve',23]};await save();window.say=()=>{};await home();await dictStart('学');
   window.keptCanvas=document.getElementById('dc');window.keptState=JSON.stringify(S);window.keptBackup=await backup();
  });
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const paper=await p.locator('#dc').boundingBox();assert.ok(paper.width>=160&&paper.height>=160,'Handwriting remains usable: '+JSON.stringify(paper));
  await p.mouse.move(paper.x+paper.width*.2,paper.y+paper.height*.3);await p.mouse.down();await p.mouse.move(paper.x+paper.width*.8,paper.y+paper.height*.3,{steps:10});await p.mouse.up();
  await p.evaluate(()=>{window.keptInk=keptCanvas.toDataURL();const data=keptCanvas.getContext('2d').getImageData(0,0,600,600).data;if(!data.some((v,i)=>i%4===3&&v))throw Error('Actual pointer stroke produced no ink');});
  await p.getByRole('button',{name:'Next: Pinyin',exact:true}).click();
  await p.locator('[data-t]').first().click();await p.locator('[data-tn="2"]').click();
  const pinyin=await p.locator('#pyout').innerText();
  await p.getByRole('button',{name:'Back',exact:true}).last().click();
  for(const viewport of [{width:1180,height:820},{width:320,height:568},{width:360,height:640}]){
   await p.setViewportSize(viewport);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   assert.equal(await p.evaluate(()=>document.getElementById('dc')===keptCanvas&&keptCanvas.toDataURL()===keptInk),true,'Canvas node and ink survive step/resize');
   assert.equal(await p.evaluate(()=>JSON.stringify(S)===keptState),true,'Step/resize never score or earn');
   assert.equal(await p.evaluate(async()=>await backup()===keptBackup),true,'Exact backup unchanged by geometry');
  }
  await p.getByRole('button',{name:'Next: Pinyin',exact:true}).click();assert.equal(await p.locator('#pyout').innerText(),pinyin,'Pinyin selection survives width changes');
  await p.evaluate(async()=>{await home();trace();});await p.waitForFunction(()=>writer?._quiz&&document.querySelectorAll('#hw path').length>0);
  await p.evaluate(()=>{window.keptWriter=writer;window.keptWriterRoot=document.getElementById('hw');window.keptQuiz=writer._quiz;window.beforeWriter=JSON.stringify(S);});
  for(const viewport of [{width:1365,height:650},{width:360,height:640}]){
   await p.setViewportSize(viewport);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   assert.equal(await p.evaluate(()=>writer===keptWriter&&document.getElementById('hw')===keptWriterRoot&&writer._quiz===keptQuiz&&JSON.stringify(S)===beforeWriter),true,'Same live writer and quiz survive rotation without scoring');
  }
  await p.evaluate(()=>showSummaryHelp());
  await p.getByLabel('Main idea',{exact:true}).fill('Synthetic 草稿');
  await p.getByRole('button',{name:'Next: Key details',exact:true}).click();await p.getByLabel('Key details',{exact:true}).fill('Details retained.');
  await p.getByRole('button',{name:'Next: My summary',exact:true}).click();await p.getByLabel('My summary',{exact:true}).fill('My full synthetic summary.');
  await p.waitForFunction(()=>document.getElementById('summary-save-status').textContent.includes('Draft saved'));
  await p.evaluate(()=>{window.keptDraft=document.getElementById('summary-draft');keptDraft.setSelectionRange(3,8);window.keptSummary=JSON.stringify(S);});
  for(const viewport of [{width:1180,height:820},{width:360,height:400},{width:360,height:640}]){
   await p.setViewportSize(viewport);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const result=await p.evaluate(()=>({same:document.getElementById('summary-draft')===keptDraft,value:keptDraft.value,selection:[keptDraft.selectionStart,keptDraft.selectionEnd],focus:document.activeElement===keptDraft,saved:JSON.stringify(S)===keptSummary}));
   assert.deepEqual(result,{same:true,value:'My full synthetic summary.',selection:[3,8],focus:true,saved:true});
   for(const selector of ['#summary-draft','#summary-clear','.compact-step-navigation button:first-child']){
    const el=p.locator(selector);if(!await el.isVisible())continue;
    const box=await el.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=viewport.height&&box.height>=44,selector+' stays usable with a short keyboard viewport');
   }
  }
  await p.evaluate(()=>{document.activeElement.blur();});await p.reload();await p.evaluate(()=>GROVE_STARTED);await p.evaluate(()=>showSummaryHelp());
  assert.equal(await p.locator('#summary-main-idea').inputValue(),'Synthetic 草稿');assert.equal(await p.locator('#summary-details').inputValue(),'Details retained.');assert.equal(await p.locator('#summary-draft').inputValue(),'My full synthetic summary.');
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  console.log('PASS: real ink, pinyin, exact backups, same live writer/quiz, draft/caret/focus, short input viewport and reload retained.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
