// Exercise real app actions and browser storage. Only transaction latency/failure
// is injected, matching the asynchronous native repository contract.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:820,height:1060}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/adapters/web-storage.js*',async route=>{
   const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\n{
    const create=GroveStorage.createRepository;
    GroveStorage.createRepository=options=>{const repository=create(options);
     for(const method of ['saveProfile','saveChildSettings']){const original=repository[method];repository[method]=(...args)=>{
      if(!window.__holdCommit)return original(...args);
      window.__heldCommits=(window.__heldCommits||0)+1;
      return new Promise((resolve,reject)=>{window.__releaseCommit=()=>{window.__holdCommit=false;resolve(original(...args));};window.__rejectCommit=()=>{window.__holdCommit=false;reject(Error('Synthetic disk full'));};});
     };}return repository;};
   }`});
  });
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4173/');await page.locator('#go').waitFor();
  await page.evaluate(async()=>{
   PR={cur:'action-a',list:[{id:'action-a',name:'Synthetic A',gr:'2',av:'🐼'},{id:'action-b',name:'Synthetic B',gr:'4',av:'🐳'}]};await savePR();await loadS();say=()=>{};await home();
  });
  const initial=await page.evaluate(()=>localStorage.getItem('zh_p_action-a'));
  await page.evaluate(()=>{listen(ALL.find(c=>c.c==='狗'));window.__holdCommit=true;});
  await page.locator('[data-c="狗"]').click();await page.waitForFunction(()=>window.__heldCommits===1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('zh_p_action-a')),initial,'No learner bytes change before acknowledgement');
  assert.doesNotMatch(await page.locator('#m').innerText(),/You got it|Got it/,'Do not celebrate a pending answer');
  assert.doesNotMatch(await page.locator('#sk').innerText(),/Next/,'Do not advance before acknowledgement');
  await page.evaluate(()=>{document.querySelector('[data-c="狗"]').click();document.getElementById('sk').click();});
  assert.equal(await page.evaluate(()=>window.__heldCommits),1,'Repeated answer and Next do not create another commit');
  await page.evaluate(()=>window.__releaseCommit());await page.getByText('You got it! 🎉',{exact:true}).waitFor();
  let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('zh_p_action-a')));assert.equal(saved.pts['狗'],1);assert.equal(saved.learning.chars['狗'].skills.listen.attempts,1);
  const acknowledged=await page.evaluate(()=>localStorage.getItem('zh_p_action-a'));

  await page.evaluate(()=>{listen(ALL.find(c=>c.c==='狗'));window.__holdCommit=true;});await page.locator('[data-c="狗"]').click();await page.waitForFunction(()=>window.__heldCommits===2);
  await page.evaluate(()=>window.__rejectCommit());await page.locator('#progress-action-retry').waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('zh_p_action-a')),acknowledged,'Rejected answer retains exact prior bytes');
  assert.equal(await page.evaluate(()=>S.pts['狗']),1,'Rejected candidate rolls back in memory');
  await page.locator('#progress-action-retry').click();await page.getByText('You got it! 🎉',{exact:true}).waitFor();
  saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('zh_p_action-a')));assert.equal(saved.pts['狗'],2);assert.equal(saved.learning.chars['狗'].skills.listen.attempts,2,'Retry records the attempt exactly once');

  const other=await page.evaluate(()=>localStorage.getItem('zh_p_action-b'));
  await page.evaluate(()=>{listen(ALL.find(c=>c.c==='狗'));window.__holdCommit=true;});await page.locator('[data-c="狗"]').click();await page.waitForFunction(()=>window.__heldCommits===3);
  await page.evaluate(()=>{PR.cur='action-b';window.__switching=loadS({persist:false});window.__releaseCommit();});await page.evaluate(()=>window.__switching);
  assert.equal(await page.evaluate(()=>PR.cur),'action-b');assert.equal(await page.evaluate(()=>GROVE_STATE_OWNER),'action-b');assert.equal(await page.evaluate(()=>S.pts['狗']||0),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('zh_p_action-b')),other,'Late A completion cannot overwrite B');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zh_p_action-a')).pts['狗']),3,'Acknowledged A save remains attached to A');

  await page.evaluate(async()=>{await home();await grown();});await page.locator('#gn').fill('Saved synthetic B');
  await page.evaluate(()=>{window.__holdCommit=true;});await page.locator('#gsave').click();await page.waitForFunction(()=>window.__heldCommits===4);
  assert.equal(await page.locator('#gov').count(),1,'Settings stay open while transaction is pending');assert.equal(await page.evaluate(()=>PR.list.find(p=>p.id==='action-b').name),'Synthetic B');
  await page.locator('#gn').fill('Later unsubmitted edit');await page.evaluate(()=>window.__releaseCommit());await page.locator('#gov').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>PR.list.find(p=>p.id==='action-b').name),'Saved synthetic B','Commit uses the submitted snapshot');

  await page.evaluate(()=>showSummaryHelp());await page.evaluate(()=>{window.__holdCommit=true;});await page.locator('#summary-draft').fill('First draft');await page.waitForFunction(()=>window.__heldCommits===5);
  await page.locator('#summary-draft').fill('Latest draft while saving');await page.evaluate(()=>window.__releaseCommit());
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('zh_p_action-b')).homeworkHelp?.summary?.summary==='Latest draft while saving');
  assert.equal(await page.locator('#summary-draft').inputValue(),'Latest draft while saving');

  await page.evaluate(async()=>{
   await home();const create=WritingSurface.create;
   WritingSurface.create=(...args)=>{const instance=create(...args),quiz=instance.quiz.bind(instance);instance.quiz=options=>{window.__traceCallbacks=options;return quiz(options);};return instance;};
   const card=ALL.find(c=>c.c==='狗');await startStudyRound('practice',{chars:['狗'],units:[],modes:['trace'],limit:1},[card],[['trace',card]]);
   window.__strokeBaseline=window.__heldCommits;window.__holdCommit=true;window.__firstStroke=window.__traceCallbacks.onMistake();
  });
  await page.waitForFunction(()=>window.__heldCommits===window.__strokeBaseline+1);
  await page.evaluate(async()=>{
   const queued=[window.__firstStroke,window.__traceCallbacks.onMistake(),window.__traceCallbacks.onMistake(),window.__traceCallbacks.onComplete({totalMistakes:3})];
   window.__releaseCommit();await Promise.all(queued);
  });
  const tracing=await page.evaluate(()=>({attempt:studyAttemptInfo(),skill:S.learning?.chars?.['狗']?.skills?.trace}));
  assert.equal(tracing.attempt.strokes,3,'Writer callbacks that arrive during a commit must queue instead of disappear');
  assert.equal(tracing.skill.assisted,1,'Completion follows all saved mistakes and cannot become an independent success');
  assert.equal(tracing.skill.correct,0);
  assert.deepEqual(errors,[]);console.log('PASS: delayed/rejected real app answers, duplicate taps, owner switch, frozen settings and queued draft retry obey durable acknowledgement.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
