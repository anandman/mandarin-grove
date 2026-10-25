const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}),failed=[];
 async function run(name,fn){
  if(process.env.CASE_FILTER&&!name.includes(process.env.CASE_FILTER))return;
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:name.includes('delayed dictionary')?'block':'allow'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/api/feedback',r=>r.abort());
  try{
   await page.goto(process.env.APP_URL||'http://127.0.0.1:4200');
   await page.evaluate(()=>{PR={cur:'supported-synthetic',list:[{id:'supported-synthetic',name:'Synthetic',gr:'2',av:'🐼'}]};savePR();loadS();S.stars=77;S.opaque={preserve:'original'};save();say=()=>{};home();});
   await fn(page,context);assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>S.opaque),{preserve:'original'});console.log('PASS:',name);
  }catch(e){failed.push(name);console.error('FAIL:',name,e.stack);}finally{await context.close();}
 }
 try{
  await run('sentence hints are independent and inline lookup keeps the reading and earned history',async(p,c)=>{
   const story=fs.readFileSync('tests/fixtures/online/story-0008.md','utf8');await c.route('https://raw.githubusercontent.com/**',r=>r.fulfill({body:story,contentType:'text/plain'}));
   await p.evaluate(()=>{PR.list[0].gr='4';savePR();loadS();showOnlineLibrary({selection:{chars:['我'],units:[],modes:['trace'],limit:5}});});const before=await p.evaluate(()=>backup());
   await p.locator('[data-reading="story-0008"]').click();await p.locator('.online-paragraph').first().waitFor();
   assert.equal(await p.locator('.online-pinyin:visible').count(),0);assert.equal(await p.locator('.online-english:visible').count(),0);
   await p.locator('#online-show-pinyin-1').click();assert.equal(await p.locator('.online-pinyin:visible').count(),1);assert.equal(await p.locator('.online-english:visible').count(),0);
   await p.locator('.reading-word').filter({hasText:'我'}).first().click();await p.locator('#reading-lookup-body .reading-dictionary-entry').first().waitFor();
   assert.equal(await p.locator('.online-paragraph').count(),8);await p.locator('#reading-lookup-close').click();assert.equal(await p.locator('.online-pinyin:visible').count(),1);assert.equal(await p.evaluate(()=>backup()),before);
  });
  await run('Practice reading uses the same saved unit choices and preserves a paused character round offline',async(p,c)=>{
   await p.waitForFunction(()=>OFFLINE_STATUS==='ready');
   const before=await p.evaluate(()=>{const config={units:['2:1'],chars:['猫','狗'],modes:['trace'],limit:5};S.cfg.studyChoices={2:{practice:config}};S.cfg.studyRounds={2:{practice:{id:'preserved-round',kind:'practice',config,q:[['trace','猫']],cursor:0,results:{}}}};save();showStudySetup('practice');return {round:JSON.stringify(S.cfg.studyRounds),stars:S.stars,learning:JSON.stringify(S.learning)};});
   await p.locator('#study-reading').click();assert.equal(await p.locator('[data-reading="grove-pets"]').count(),1);assert.equal(await p.locator('[data-reading="grove-tree"]').count(),0);
   await c.setOffline(true);await p.locator('[data-reading="grove-pets"]').click();await p.locator('#online-passages').waitFor();assert.match(await p.locator('#online-passages').innerText(),/小猫/);
   assert.equal(await p.evaluate(()=>JSON.stringify(S.cfg.studyRounds)),before.round);assert.equal(await p.evaluate(()=>S.stars),before.stars);assert.equal(await p.evaluate(()=>JSON.stringify(S.learning)),before.learning);
   await p.locator('#page-back').click();await p.locator('#reading-choices').click();assert.deepEqual(await p.evaluate(()=>STUDY_DRAFT.config.chars),['猫','狗']);
  });
  await run('Review comprehension resumes first answers, records later help and roundtrips in backups',async p=>{
   const before=await p.evaluate(()=>{const config={units:['2:1'],chars:['猫','狗'],modes:['trace'],limit:5};S.cfg.studyChoices={2:{review:config}};save();showOnlineLibrary({kind:'review'});return {stars:S.stars,learning:JSON.stringify(S.learning)};});
   await p.locator('[data-reading="grove-pets"]').click();await p.locator('#reading-start-questions').click();await p.locator('input[name="reading-answer"][value="friend"]').check();await p.locator('#reading-check').click();await p.locator('#reading-answer-feedback').waitFor();
   await p.reload();await p.evaluate(()=>{say=()=>{};showOnlineLibrary({kind:'review'});});await p.locator('[data-reading="grove-pets"]').click();await p.locator('#reading-answer-feedback').waitFor();assert.match(await p.locator('#reading-answer-feedback').innerText(),/^Correct/);
   await p.locator('#online-show-english-1').click();await p.locator('#reading-next').click();await p.locator('input[name="reading-answer"][value="fish"]').check();await p.locator('#reading-check').click();await p.locator('#reading-next').click();assert.match(await p.locator('#reading-questions').innerText(),/2 of 2 correct · 1 answered with help/);
   const result=await p.evaluate(()=>{const bank=S.readingStudy,entry=bank.history[0],decoded=GroveBackup.decodeBackup(backup(),GROVE_CODEC);return {entry,copy:JSON.parse(decoded.rawProfiles[PR.cur]).readingStudy,bank,stars:S.stars,learning:JSON.stringify(S.learning)};});
   assert.equal(result.entry.responses.dog.assisted,false);assert.equal(result.entry.responses.food.assisted,true);assert.deepEqual(result.copy,result.bank);assert.equal(result.stars,before.stars);assert.equal(result.learning,before.learning);
  });
  await run('failed comprehension saves keep the first answer and block advancement until retry',async p=>{
   await p.evaluate(()=>showOnlineLibrary({selection:{chars:['猫','狗'],units:['2:1'],modes:['trace'],limit:5}}));await p.locator('[data-reading="grove-pets"]').click();await p.locator('#reading-start-questions').click();await p.locator('input[name="reading-answer"][value="friend"]').check();
   const before=await p.evaluate(()=>{window.originalReadingSet=Storage.prototype.setItem;const raw=localStorage.getItem('zh_p_'+PR.cur);Storage.prototype.setItem=function(k,v){if(k==='zh_p_supported-synthetic')throw new DOMException('quota','QuotaExceededError');return originalReadingSet.call(this,k,v);};return raw;});
   await p.locator('#reading-check').click();await p.locator('#reading-save-retry').waitFor();assert.equal(await p.locator('#reading-check').isDisabled(),true);assert.equal(await p.evaluate(()=>localStorage.getItem('zh_p_'+PR.cur)),before);
   await p.evaluate(()=>Storage.prototype.setItem=originalReadingSet);await p.locator('#reading-save-retry').click();await p.locator('#reading-answer-feedback').waitFor();assert.match(await p.locator('#reading-answer-feedback').innerText(),/^Correct/);assert.equal(await p.locator('#reading-next').isEnabled(),true);
  });
  await run('delayed dictionary completes an open school entry without losing focus or selection',async(p,c)=>{
   let release;const gate=new Promise(r=>release=r);await c.route('**/vendor/cc-cedict/dictionary.json',async r=>{await gate;await r.continue();});
   await p.evaluate(()=>showHomeworkLookup());await p.locator('#lookup-input').fill('行');await p.locator('#lookup-search').click();await p.locator('[data-lookup-text="行"]').click();await p.locator('[data-lookup-char="行"]').check();await p.getByRole('button',{name:'Hear pronunciation',exact:true}).focus();
   assert.doesNotMatch(await p.locator('#lookup-detail').innerText(),/háng/);release();await p.locator('#lookup-bank-status[data-ready="true"]').waitFor();assert.equal(await p.locator('[data-lookup-char="行"]').isChecked(),true);assert.equal(await p.getByRole('button',{name:'Hear pronunciation',exact:true}).evaluate(e=>e===document.activeElement),true);await p.locator('#lookup-full-readings > summary').click();assert.match(await p.locator('#lookup-full-readings').innerText(),/háng/);
  });
  await run('curated word examples keep full dictionary meanings available',async p=>{
   await p.evaluate(()=>showHomeworkLookup());await p.locator('#lookup-bank-status[data-ready="true"]').waitFor();await p.waitForFunction(()=>!!HELP_VOCABULARY_PACK);await p.locator('#lookup-input').fill('千万');await p.locator('#lookup-search').click();await p.locator('[data-lookup-text="千万"]').click();await p.locator('#lookup-full-readings > summary').click();assert.match(await p.locator('#lookup-full-readings').innerText(),/countless|by all means/);
  });
  await run('dictionary survives a disconnected cold launch and searches non-school single characters',async(p,c)=>{
   await p.waitForFunction(()=>OFFLINE_STATUS==='ready');await p.evaluate(()=>navigator.serviceWorker.ready);const before=await p.evaluate(()=>backup());
   await c.setOffline(true);await p.reload();await p.evaluate(()=>showHomeworkLookup());
   await p.locator('#lookup-bank-status[data-ready="true"]').waitFor();await p.locator('#lookup-input').fill('鑫');await p.locator('#lookup-search').click();
   await p.locator('[data-lookup-text="鑫"]').waitFor();assert.equal(await p.evaluate(()=>backup()),before);
  });
  await run('explicit app update preserves saved readings and learner data',async p=>{
   await p.waitForFunction(()=>OFFLINE_STATUS==='ready');const before=await p.evaluate(async()=>{const c=await caches.open('mandarin-grove-public-readings-v1');await c.put('/synthetic-public-text',new Response('preserved'));return backup();});
   await p.evaluate(()=>showAppUpdate('synthetic-new-version'));await p.locator('#update-now').click();await p.waitForFunction(()=>!document.querySelector('#upd')?.open);
   assert.equal(await p.evaluate(async()=>{const c=await caches.open('mandarin-grove-public-readings-v1');return (await c.match('/synthetic-public-text'))?.text();}),'preserved');assert.equal(await p.evaluate(()=>backup()),before);
  });
 }finally{await browser.close();}
 assert.deepEqual(failed,[]);
})().catch(e=>{console.error(e);process.exit(1);});
