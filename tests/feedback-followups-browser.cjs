const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']}),failures=[];
 async function run(name,fn){if(process.env.CASE_FILTER&&!name.includes(process.env.CASE_FILTER))return;const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);await context.route('**/api/feedback',r=>r.abort());
 try{await p.goto(process.env.APP_URL||'http://127.0.0.1:4205/');await p.evaluate(()=>{PR={cur:'followup-a',list:[{id:'followup-a',name:'Synthetic A',gr:'4',av:'🐼'},{id:'followup-b',name:'Synthetic B',gr:'2',av:'🐳'}]};savePR();loadS();S.stars=77;S.opaque={keep:'yes'};save();window.followupRealSay=say;say=()=>{};home();});await fn(p);assert.deepEqual(errors,[]);console.log('PASS:',name);}catch(e){failures.push(name);console.error('FAIL:',name,e.stack);}finally{await context.close();}}
 try{
  await run('reported writing words provide ideas in direct input and browsing',async p=>{
   const before=await p.evaluate(()=>backup());await p.evaluate(()=>showWritingIdeas());
   for(const word of ['电脑','脏乱']){await p.locator('#writing-input').fill(word);await p.locator('#writing-generate').click();assert.equal(await p.locator('.writing-word span').first().textContent(),word);await p.locator('#writing-browse').evaluate(e=>e.open=true);await p.locator('#writing-browse-search').fill(word);assert.equal(await p.locator('#writing-browse-list button').count(),1);await p.locator('#writing-browse-list button').click();assert.equal(await p.locator('.writing-word span').first().textContent(),word);}
   assert.equal(await p.evaluate(()=>backup()),before);
  });
  await run('dictionary word starts browser speech directly and exposes a failure with report context',async p=>{
   await p.evaluate(()=>{
    window.followupSpoken=[];window.followupAudio=[];
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],cancel(){},addEventListener(){},speak(u){followupSpoken.push(u.text);queueMicrotask(()=>u.onerror());}}});
    window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};window.Audio=class{constructor(url){followupAudio.push(url);}play(){return Promise.reject(Error('no file'));}pause(){}};
    localStorage.setItem('zh_voice','reference');say=followupRealSay;showHomeworkLookup();
   });
   await p.locator('#lookup-bank-status[data-ready="true"]').waitFor();await p.locator('#lookup-input').fill('关于');await p.locator('#lookup-search').click();await p.locator('[data-lookup-text="关于"]').click();const before=await p.evaluate(()=>backup());
   await p.getByRole('button',{name:'Hear pronunciation',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#speech-status').textContent.includes('Could not play'));
   assert.deepEqual(await p.evaluate(()=>followupSpoken),['关于']);assert.deepEqual(await p.evaluate(()=>followupAudio),[]);assert.equal(await p.locator('#speech-status').isVisible(),true);
   const snapshot=await p.evaluate(()=>feedbackSnapshot());assert.equal(snapshot.question.character,'关于');assert.equal(snapshot.speech.character,'关于');assert.equal(snapshot.speech.pinyin,'guān yú');assert.equal(snapshot.speech.source,'browser speech');assert.equal(await p.evaluate(()=>localStorage.getItem('zh_voice')),'reference');assert.equal(await p.evaluate(()=>backup()),before);
  });
  await run('sentence reward requires confirmation, preserves cancel and commits only once',async p=>{
   await p.evaluate(()=>showWritingIdeas());await p.locator('#writing-input').fill('雨');await p.locator('#writing-generate').click();const before=await p.evaluate(()=>backup()),balance=await p.evaluate(()=>groveWallet(S).balance);
   await p.locator('#writing-finish').dblclick();assert.equal(await p.evaluate(()=>backup()),before);await p.locator('#writing-confirm').waitFor();await p.locator('#writing-keep').click();assert.equal(await p.evaluate(()=>backup()),before);
   await p.locator('#writing-finish').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#writing-keep').evaluate(e=>e===document.activeElement),true);await p.locator('#writing-confirm').dblclick();assert.equal(await p.evaluate(()=>groveWallet(S).balance),balance+1);assert.equal(await p.locator('#writing-finish').isDisabled(),true);assert.equal(await p.evaluate(()=>S.stars),77);
   await p.reload();assert.equal(await p.evaluate(()=>groveWallet(S).balance),balance+1);
  });
  await run('stale sentence confirmations cannot reward another child or a different idea',async p=>{
   await p.evaluate(()=>showWritingIdeas());await p.locator('#writing-input').fill('雨');await p.locator('#writing-generate').click();await p.locator('#writing-finish').click();await p.evaluate(()=>window.oldConfirm=document.querySelector('#writing-confirm').onclick);await p.locator('#writing-another').click();const same=await p.evaluate(()=>backup());await p.evaluate(()=>oldConfirm());assert.equal(await p.evaluate(()=>backup()),same);
   await p.locator('#writing-finish').click();await p.evaluate(()=>window.oldConfirm=document.querySelector('#writing-confirm').onclick);await p.evaluate(()=>{PR.cur='followup-b';savePR();loadS();home();});const other=await p.evaluate(()=>backup());await p.evaluate(()=>oldConfirm());assert.equal(await p.evaluate(()=>backup()),other);
  });
  await run('a failed confirmation save can be retried without losing or doubling the reward',async p=>{
   await p.evaluate(()=>showWritingIdeas());await p.locator('#writing-input').fill('雨');await p.locator('#writing-generate').click();await p.locator('#writing-finish').click();const balance=await p.evaluate(()=>groveWallet(S).balance);
   await p.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='zh_p_followup-a')throw Error('synthetic save failure');return originalSet.call(this,k,v);};});await p.locator('#writing-confirm').click();assert.equal(await p.evaluate(()=>groveWallet(S).balance),balance);assert.match(await p.locator('#writing-status').innerText(),/Could not save/);await p.evaluate(()=>Storage.prototype.setItem=originalSet);await p.locator('#writing-confirm').click();assert.equal(await p.evaluate(()=>groveWallet(S).balance),balance+1);
  });
 }finally{await browser.close();}assert.deepEqual(failures,[]);
})().catch(e=>{console.error(e);process.exit(1);});
