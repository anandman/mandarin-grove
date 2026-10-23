const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:390,height:740}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function openStudyChoices(){const editor=page.locator('#study-choice-editor');if(await editor.getAttribute('open')===null)await editor.locator(':scope > summary').click();}
await page.goto(process.env.APP_URL||'http://127.0.0.1:4181');
 await page.evaluate(()=>{PR={cur:'word-round',list:[{id:'word-round',name:'Learner',gr:'4',av:'🐳'},{id:'other',name:'Other',gr:'2',av:'🐼'}]};savePR();S=blank();S.stars=149;S.pts={祖:5};S.cfg.set=['学','生','校'];localStorage.setItem('zh_p_word-round',JSON.stringify(S));loadS();window.say=()=>{};home()});
 // A missing words selector/dispatch must prevent a real scored word round.
 for(const kind of ['Practice','Review']){
  await page.getByRole('button',{name:kind,exact:true}).click();
  assert.equal(await page.locator('[data-study-mode="words"]').count(),1,'Words available in '+kind);
  await page.getByRole('button',{name:'Close session choices',exact:true}).click();
 }
 assert.equal(await page.locator('.grove-explore').getByRole('button',{name:/Build words/}).count(),0);
 await page.getByRole('button',{name:'Help',exact:true}).click();await page.getByRole('button',{name:/Writing ideas/}).click();
 await page.locator('#writing-input').fill('学');await page.locator('#writing-generate').click();assert.ok(await page.locator('#writing-result').innerText());
 await page.getByRole('button',{name:'Back to Help',exact:true}).click();assert.ok(await page.getByRole('heading',{name:'Help',exact:true}).isVisible());await page.screenshot({path:'/tmp/grove-help-phone.png'});
 await page.evaluate(()=>{home();const c=ALL.find(c=>c.c==='学');startStudyRound('review',{units:[],chars:['学'],modes:['words','flip'],limit:5},[c],[['words',c],['flip',c]])});
 await page.waitForFunction(()=>!document.getElementById('word-check')?.disabled);
 await page.locator('#word-input').fill('学校');await page.locator('#word-input').dispatchEvent('compositionstart');await page.locator('#word-input').press('Enter');
 assert.equal(await page.evaluate(()=>Object.keys(SESS.round.results).length),0,'IME confirmation is not a submitted answer');
 await page.locator('#word-input').dispatchEvent('compositionend');await page.locator('#word-check').click();
 assert.deepEqual(await page.evaluate(()=>[SESS.round.results['words:学'].correct,S.learning.chars.学.skills.words.correct,S.wordPractice.words.学]),[true,1,['学校']]);
 assert.ok(await page.locator('.word-collection').isVisible(),'Collection is revealed after grading');
 await page.locator('#word-study-next').click();await page.locator('#cd').click();await page.locator('#yes').click();
 assert.match(await page.locator('.study-finish').innerText(),/2 \/ 2/);assert.equal(await page.evaluate(()=>S.studyHistory.at(-1).q.length),2);
 // Neutral answers count toward the finite cap but never count as mistakes, skips or SRS evidence.
 await page.evaluate(()=>{const c=ALL.find(c=>c.c==='学');startStudyRound('practice',{units:[],chars:['学'],modes:['words'],limit:5},[c])});
 await page.waitForFunction(()=>!document.getElementById('word-check')?.disabled);
 assert.equal(await page.locator('.word-collection').isVisible(),false,'Collected answers must not give away an unanswered scored question');
 const before=await page.evaluate(()=>JSON.stringify([S.learning,S.stars,S.pts]));
 await page.locator('#word-input').fill('学甲乙丙');await page.locator('#word-check').click();assert.equal(await page.locator('#word-status').innerText(),'Not in our word bank yet.');
 await page.locator('#word-study-next').click();assert.equal(await page.evaluate(()=>JSON.stringify([S.learning,S.stars,S.pts])),before);
 assert.equal(await page.evaluate(()=>S.studyHistory.at(-1).score.reached),false);assert.equal(await page.getByRole('button',{name:'Practice these again',exact:true}).count(),0);assert.match(await page.locator('.study-finish').innerText(),/1 answer not checked/);
 // Wrong target then Pause/reload cannot become a clean first attempt; a collected word is reusable.
 await page.evaluate(()=>{const c=ALL.find(c=>c.c==='学');startStudyRound('review',{units:[],chars:['学'],modes:['words'],limit:5},[c])});
 await page.waitForFunction(()=>!document.getElementById('word-check')?.disabled);await page.locator('#word-input').fill('小狗');await page.locator('#word-check').click();
 await page.getByRole('button',{name:'Pause',exact:true}).click();await page.reload();await page.evaluate(()=>{window.say=()=>{};resumeStudy('review')});
 await page.waitForFunction(()=>!document.getElementById('word-check')?.disabled);await page.locator('#word-input').fill('学校');await page.locator('#word-check').click();await page.locator('#word-study-next').click();
 assert.deepEqual(await page.evaluate(()=>[S.studyHistory.at(-1).score.correct,S.learning.chars.学.skills.words.misses,S.wordPractice.words.学]),[0,1,['学校']]);
 assert.equal(await page.getByRole('button',{name:'Practice these again',exact:true}).count(),1);
 // Don't know must finish honestly without inventing an expression or excluding the character.
 await page.evaluate(()=>{const c=ALL.find(c=>c.c==='学');startStudyRound('review',{units:[],chars:['学'],modes:['words'],limit:5},[c])});
 const unknownButton=page.getByRole('button',{name:'I don’t know a word yet',exact:true});assert.equal(await unknownButton.count(),1,'An unknown word has an honest miss action');await unknownButton.click();await page.locator('#word-study-next').click();
 assert.deepEqual(await page.evaluate(()=>[S.studyHistory.at(-1).score.correct,S.learning.chars.学.skills.words.misses,(S.cfg.notLearned||[]).includes('学')]),[0,2,false]);
 // Actual shared setup starts words only and choices survive refresh.
 await page.evaluate(()=>home());await page.getByRole('button',{name:'Practice',exact:true}).click();
 await openStudyChoices();for(const input of await page.locator('[data-study-mode]').all()){if(await input.getAttribute('data-study-mode')==='words')await input.check();else await input.uncheck();}
 await page.locator('#study-start').click();await page.waitForFunction(()=>!document.getElementById('word-check')?.disabled);
 await page.getByRole('button',{name:'Pause',exact:true}).click();await page.reload();await page.evaluate(()=>{window.say=()=>{};home()});await page.getByRole('button',{name:'Practice',exact:true}).click();assert.ok(await page.locator('[data-study-mode="words"]').isChecked());await page.getByRole('button',{name:'Close session choices',exact:true}).click();
 for(const [device,width,height]of [['phone',390,740],['ipad',820,1060]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(theme=>{setAppearance(theme);const c=ALL.find(c=>c.c==='学');startStudyRound('review',{units:[],chars:['学'],modes:['words'],limit:5},[c])},theme);await page.waitForFunction(()=>!document.getElementById('word-check')?.disabled);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const r=await page.locator('#word-check').boundingBox();assert.ok(r.height>=44&&r.y+r.height<=height,'Word answer fits '+device);await page.screenshot({path:`/tmp/grove-study-words-${device}-${theme}.png`});
 }
 // A late bank response must not reopen a graded Don't know question or overwrite its result.
 for(const fail of [false,true]){
  const slow=await browser.newPage();let release;const held=new Promise(resolve=>release=resolve);
  await slow.route('**/vendor/cc-cedict/words.json*',async route=>{await held;if(fail)await route.abort();else await route.continue();});
  await slow.goto(process.env.APP_URL||'http://127.0.0.1:4181');
  await slow.evaluate(()=>{PR={cur:'slow-words',list:[{id:'slow-words',name:'Learner',gr:'2',av:'🐼'}]};savePR();S=blank();localStorage.setItem('zh_p_slow-words',JSON.stringify(S));loadS();window.say=()=>{};const c=ALL.find(c=>c.c==='学');startStudyRound('review',{units:[],chars:['学'],modes:['words'],limit:5},[c]);});
  await slow.getByRole('button',{name:'I don’t know a word yet',exact:true}).click();release();await slow.evaluate(()=>WORD_BANK_PROMISE?.catch(()=>{}));
  assert.ok(await slow.locator('#word-check').isDisabled(),'Late load cannot enable a second answer');assert.equal(await slow.locator('#word-retry').isVisible(),false);assert.match(await slow.locator('#word-status').innerText(),/Saved for more practice/);
  await slow.locator('#word-study-next').click();assert.deepEqual(await slow.evaluate(()=>[S.studyHistory.at(-1).score.correct,S.learning.chars.学.skills.words.attempts]),[0,1]);await slow.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: Help/Writing ideas, words in both flows, mixed rounds, IME, neutral score/SRS, persistent first attempts, collections and phone/tablet themes.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
