const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}}), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:4179');
    assert.equal(await page.evaluate(()=>typeof trace),'function','Independent tracing is loaded');
    await page.evaluate(() => {
      PR={cur:'activity-contract',list:[{id:'activity-contract',name:'Learner',gr:'2',av:'🐼'}]};savePR();loadS();
      S=blank();S.cfg.set=['狗','猫'];save();setCards();window.say=()=>{};home();
      window.activityQuizzes=[];
      const create=HanziWriter.create;
      HanziWriter.create=function(...args){const instance=create.apply(this,args),quiz=instance.quiz;
        instance.quiz=function(options){activityQuizzes.push(options);return quiz.call(this,options);};return instance;};
    });
    // Wrong first answers persist and cannot become successful evidence on correction.
    await page.evaluate(()=>{const card=ALL.find(c=>c.c==='狗');startStudyRound('review',{units:[],chars:['狗'],modes:['listen'],limit:5},[card],[['listen',card]])});
    await page.locator('.choices button:not([data-c="狗"])').first().click();
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    await page.evaluate(()=>resumeStudy('review'));
    await page.locator('[data-c="狗"]').click();
    assert.equal(await page.evaluate(()=>S.studyHistory[0].results['listen:狗'].outcome),'miss');
    // A detached writer must never change a later question or award progress.
    await page.evaluate(()=>{home();memory(ALL.find(c=>c.c==='狗'))});await page.waitForFunction(()=>writer?._quiz);
    await page.evaluate(()=>{window.oldActivityQuiz=activityQuizzes.at(-1);home();listen(ALL.find(c=>c.c==='猫'));window.beforeStale=JSON.stringify([S.learning,S.stars,S.pts]);oldActivityQuiz.onComplete({totalMistakes:0})});
    assert.equal(await page.evaluate(()=>JSON.stringify([S.learning,S.stars,S.pts])===beforeStale),true);
    assert.ok(await page.locator('.choices').isVisible());
    // Guided completion records one attempt even if the engine calls twice.
    await page.evaluate(()=>{home();trace(practiceCards().findIndex(c=>c.c==='狗'))});await page.waitForFunction(()=>writer?._quiz);
    await page.evaluate(()=>{activityQuizzes.at(-1).onComplete({totalMistakes:2});activityQuizzes.at(-1).onComplete({totalMistakes:0})});
    assert.equal(await page.evaluate(()=>skillState(S,'狗','trace').attempts),1);
    assert.equal(await page.evaluate(()=>skillState(S,'狗','trace').correct),1,'Tracing retains the two-mistake tolerance');
    // Watching strokes remains assistance after Pause, even with no later mistakes.
    await page.evaluate(()=>{home();const card=ALL.find(c=>c.c==='狗');startStudyRound('review',{units:[],chars:['狗'],modes:['trace'],limit:5},[card],[['trace',card]])});
    await page.locator('#watch').click();
    assert.equal(await page.evaluate(()=>studyAttemptInfo().help),true);
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    await page.evaluate(()=>resumeStudy('review'));await page.waitForFunction(()=>writer?._quiz);
    await page.evaluate(()=>activityQuizzes.at(-1).onComplete({totalMistakes:0}));
    assert.equal(await page.evaluate(()=>S.studyHistory.at(-1).results['trace:狗'].outcome),'assisted');
    assert.equal(await page.evaluate(()=>skillState(S,'狗','trace').correct),1);
    // Flip rating is available by keyboard and remains a self-report.
    await page.evaluate(()=>{home();flip(ALL.find(c=>c.c==='猫'))});
    await page.locator('#cd').focus();await page.keyboard.press('Enter');
    await page.locator('#yes').click();
    assert.equal(await page.evaluate(()=>skillState(S,'猫','flip').correct),1);
    // Dictation reports each skill separately, including wrong pinyin corrected after reload.
    await page.evaluate(()=>{home();const c=ALL.find(c=>c.c==='狗');startStudyRound('review',{units:[],chars:['狗'],modes:['dictation'],limit:5},[c],[['dictation',c]])});
    await page.locator('#dchk').click();
    assert.equal(await page.evaluate(()=>studyAttemptInfo().pinyinMiss),true);
    await page.getByRole('button',{name:'Pause',exact:true}).click();await page.reload();
    await page.evaluate(()=>{window.say=()=>{};resumeStudy('review');const original=recordStudyAnswer;recordStudyAnswer=function(review,outcome){window.activityEvidence=review.evidence;return original(review,outcome);}});
    for(const letter of 'gou')await page.locator(`[data-t="${letter}"]`).first().click();
    await page.locator('[data-tn="3"]').click();await page.locator('#dchk').click();await page.locator('#cy').click();
    assert.deepEqual(await page.evaluate(()=>activityEvidence),[{skill:'pinyin',method:'checked',outcome:'miss'},{skill:'writing',method:'self-rated',outcome:'correct'}]);
    assert.equal(await page.evaluate(()=>S.studyHistory.at(-1).score.percent),0);
    // Homophone clues do not expose the answer; rendering itself does not mutate progress.
    await page.evaluate(()=>{home();window.dictBefore=backup();CRAM=null;dictStart('祖')});
    assert.equal(await page.locator('#dictation-clue').innerText(),'Meaning: '+require('../content/curriculum.js').cards.find(c=>c.c==='祖').m);
    assert.equal(await page.locator('#app').innerText().then(text=>text.includes('祖')||text.includes('zǔ')),false);
    assert.equal(await page.evaluate(()=>backup()===dictBefore),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.deepEqual(errors,[]);
    console.log('PASS: independent activity callbacks, guided completion, keyboard flashcards, first-attempt persistence, separate dictation evidence, clues and mobile width.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1)});
