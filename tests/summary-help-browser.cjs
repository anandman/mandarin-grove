// Synthetic profiles only. A guide must preserve progress and keep drafts on-device.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[],dialogs=[];
  let acceptClear=false;
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>requests.push({url:request.url(),method:request.method()}));
  page.on('dialog',async dialog=>{dialogs.push(dialog.message());await(acceptClear?dialog.accept():dialog.dismiss());});
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4181');
  await page.evaluate(()=>{
   PR={cur:'summary-a',list:[{id:'summary-a',name:'Learner A',gr:'4',av:'🐳'},{id:'summary-b',name:'Learner B',gr:'2',av:'🐼'}]};savePR();
   const state=blank();state.stars=149;state.pts={祖:6};state.cfg.set=['祖','狗'];state.cfg.cramUnits={'4':[1,3]};
   state.homeworkHelp={other:{keep:'existing homework data'}};
   localStorage.setItem('zh_p_summary-a',JSON.stringify(state));loadS();home();
  });
  const state=()=>page.evaluate(()=>JSON.stringify(S));
  const learning=()=>page.evaluate(()=>{const {homeworkHelp,...progress}=S;return JSON.stringify(progress);});
  const open=async()=>{await page.getByRole('button',{name:'Help',exact:true}).click();const entry=page.getByRole('button',{name:/^Plan a summary(?:\s|$)/});assert.equal(await entry.count(),1,'Help must offer the local summary planning guide');await entry.click();};
  const baseline=await state(),progress=await learning(),stored=await page.evaluate(()=>localStorage.getItem('zh_p_summary-a'));
  await open();
  assert.equal(await state(),baseline,'Entering the helper must not create a draft or mutate any saved state');
  assert.equal(await page.evaluate(()=>localStorage.getItem('zh_p_summary-a')),stored);
  assert.equal(await page.getByRole('heading',{name:/^Plan a summary(?:\s|$)/}).count(),1);
  assert.match(await page.locator('#summary-help').innerText(),/does not check your answer/i);
  assert.match(await page.locator('#summary-help').innerText(),/on this device/i);
  assert.equal(await page.locator('#summary-reading').isVisible(),false,'Pasting reading is optional and collapsed');
  assert.equal(await page.locator('#summary-main-idea').inputValue(),'');
  assert.equal(await page.locator('#summary-clear').isDisabled(),true,'An empty guide has no draft to clear');
  assert.equal(await page.evaluate(()=>({session:SESS,cram:CRAM,study:document.body.dataset.study,question:feedbackQuestion})).then(x=>JSON.stringify(x)),JSON.stringify({session:null,cram:null,question:null}));

  // Real input events persist all four fields without generating skill/reward evidence.
  const draft={reading:'小河旁有一棵树。\n<script>window.summaryInjected=true</script>',mainIdea:'孩子们一起照顾小树。',details:'他们每天浇水。\n后来小树长高了。',summary:'孩子们照顾小树，给它浇水。小树慢慢长高了。'};
  await page.locator('.summary-reading > summary').click();
  await page.getByLabel('Reading (optional)',{exact:true}).fill(draft.reading);
  await page.getByLabel('Main idea',{exact:true}).fill(draft.mainIdea);
  await page.getByLabel('Key details',{exact:true}).fill(draft.details);
  await page.getByLabel('My summary',{exact:true}).fill(draft.summary);
  assert.deepEqual(await page.evaluate(()=>S.homeworkHelp.summary),draft);
  assert.equal(await learning(),progress,'Planning does not change score, mastery, learning evidence or rewards');
  assert.equal(await page.evaluate(()=>window.summaryInjected),undefined,'Pasted reading is never interpreted as HTML');
  const saved=await state();
  // Profile storage failure must keep visible text and the prior persisted draft.
  const persisted=await page.evaluate(()=>localStorage.getItem('zh_p_summary-a'));
  await page.evaluate(()=>{
   window.summarySetItem=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,value){if(key==='zh_p_summary-a')throw new DOMException('Synthetic storage full','QuotaExceededError');return summarySetItem.call(this,key,value);};
  });
  await page.locator('#summary-main-idea').fill('New main idea that has not saved yet.');
  assert.match(await page.locator('#summary-save-status').innerText(),/could not save/i);
  assert.equal(await page.locator('#summary-main-idea').inputValue(),'New main idea that has not saved yet.');
  assert.equal(await page.evaluate(()=>S.homeworkHelp.summary.mainIdea),'New main idea that has not saved yet.');
  assert.equal(await page.evaluate(()=>localStorage.getItem('zh_p_summary-a')),persisted,'Failed save preserves the previous persisted draft');
  assert.equal(await learning(),progress,'A failed draft write does not change learning or rewards');
  acceptClear=true;const beforeFailedClear=await state();
  await page.getByRole('button',{name:'Clear draft',exact:true}).click();
  assert.match(await page.locator('#summary-save-status').innerText(),/could not clear/i);
  assert.equal(await state(),beforeFailedClear,'A failed clear restores the in-memory draft');
  assert.equal(await page.locator('#summary-main-idea').inputValue(),'New main idea that has not saved yet.');
  assert.equal(await page.locator('#summary-draft').inputValue(),draft.summary,'A failed clear leaves the text visible');
  assert.equal(await page.evaluate(()=>localStorage.getItem('zh_p_summary-a')),persisted);
  await page.evaluate(()=>{Storage.prototype.setItem=summarySetItem;delete window.summarySetItem;});
  dialogs.length=0;acceptClear=false;
  await page.locator('#summary-main-idea').fill(draft.mainIdea);
  assert.equal(await state(),saved,'Typing again retries a failed save without losing the draft');
  assert.equal(await page.evaluate(()=>localStorage.getItem('zh_p_summary-a')),persisted);
  assert.match(await page.locator('#summary-save-status').innerText(),/draft saved/i);
  await page.getByRole('button',{name:'Report a problem',exact:true}).click();
  const report=await page.locator('#feedback-output').inputValue();
  for(const text of Object.values(draft))assert.ok(!report.includes(text),'Feedback must not automatically include a typed reading or draft');
  await page.getByRole('button',{name:'Close feedback',exact:true}).click();
  await page.reload();await page.evaluate(()=>home());await open();
  for(const [id,value]of Object.entries({'summary-reading':draft.reading,'summary-main-idea':draft.mainIdea,'summary-details':draft.details,'summary-draft':draft.summary}))assert.equal(await page.locator('#'+id).inputValue(),value,'Draft survives a reload');
  assert.equal(await state(),saved,'Reload and reopening preserve the full saved draft');

  // A stale screen must not write the current child's state, even before navigation.
  await page.evaluate(()=>{window.oldSummaryInput=document.getElementById('summary-main-idea');window.oldSummaryClear=document.getElementById('summary-clear');PR.cur='summary-b';savePR();loadS();});
  const otherBefore=await state();
  await page.evaluate(()=>{oldSummaryInput.value='Stale child A event';oldSummaryInput.dispatchEvent(new Event('input',{bubbles:true}));oldSummaryClear.click();});
  assert.equal(await state(),otherBefore,'Owner guard blocks stale events while the old screen is still connected');
  assert.equal(dialogs.length,0,'A stale screen must not even request a draft clear');
  await page.evaluate(()=>showSummaryHelp());
  assert.equal(await page.locator('#summary-main-idea').inputValue(),'','Children have separate drafts');
  assert.equal(await state(),otherBefore,'Entering with a fresh child does not create homework state');
  await page.evaluate(()=>{oldSummaryInput.value='Detached child A event';oldSummaryInput.dispatchEvent(new Event('input',{bubbles:true}));oldSummaryClear.click();});
  assert.equal(await state(),otherBefore,'Detached controls cannot update a later screen');
  assert.equal(dialogs.length,0);
  await page.locator('#summary-draft').fill('第二个孩子自己的摘要。');
  const otherDraft=await state();
  await page.evaluate(()=>{PR.cur='summary-a';savePR();loadS();home();});await open();
  assert.deepEqual(await page.evaluate(()=>S.homeworkHelp.summary),draft);

  // The existing backup/restore path includes both children without special handling.
  const code=await page.evaluate(()=>backup()),decoded=JSON.parse(Buffer.from(code,'base64').toString('utf8'));
  assert.deepEqual(JSON.parse(decoded.data['summary-a']).homeworkHelp.summary,draft);
  assert.equal(JSON.parse(decoded.data['summary-b']).homeworkHelp.summary.summary,'第二个孩子自己的摘要。');
  await page.evaluate(()=>{S.homeworkHelp.summary.summary='Changed after backup';save();grown();});
  await page.locator('#grest').click();await page.locator('#grt').fill(code);await page.locator('#grr').click();
  await page.locator('.pop').waitFor({state:'detached'});
  await open();assert.deepEqual(await page.evaluate(()=>S.homeworkHelp.summary),draft,'Normal backup restore retains the summary draft');

  // Cancel is exactly non-destructive; confirmed clear removes only this child's draft.
  const beforeCancel=await state(),beforeCancelBackup=await page.evaluate(()=>backup());
  await page.getByRole('button',{name:'Clear draft',exact:true}).click();
  assert.equal(dialogs.length,1);assert.match(dialogs[0],/clear.*summary.*draft/i);
  assert.equal(await state(),beforeCancel,'Cancelling clear preserves the exact draft');
  assert.equal(await page.evaluate(()=>backup()),beforeCancelBackup);
  acceptClear=true;await page.getByRole('button',{name:'Clear draft',exact:true}).click();
  assert.equal(dialogs.length,2);
  assert.equal(await page.evaluate(()=>S.homeworkHelp.summary),undefined);
  assert.deepEqual(await page.evaluate(()=>S.homeworkHelp.other),{keep:'existing homework data'});
  assert.equal(await learning(),progress,'Clear draft does not change learning or rewards');
  assert.equal(await page.evaluate(()=>localStorage.getItem('zh_p_summary-b')),otherDraft,'Clear leaves the other child untouched');
  for(const id of ['summary-reading','summary-main-idea','summary-details','summary-draft'])assert.equal(await page.locator('#'+id).inputValue(),'');
  assert.equal(await page.locator('#summary-clear').isDisabled(),true);

  // Restore text and inspect compact light/dark phone and tablet layouts.
  await page.locator('#summary-main-idea').fill(draft.mainIdea);
  await page.locator('#summary-details').fill(draft.details);
  await page.locator('#summary-draft').fill(draft.summary);
  for(const [device,width,height]of [['small-phone',320,700],['phone',390,844],['ipad',820,1060]])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height});await page.evaluate(value=>setAppearance(value),theme);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Summary fits '+device+' '+theme);
   for(const id of ['summary-main-idea','summary-details','summary-draft'])assert.ok(await page.locator('#'+id).evaluate(element=>parseFloat(getComputedStyle(element).fontSize)>=16),'Readable text entry on '+device);
   const clear=await page.locator('#summary-clear').boundingBox();assert.ok(clear.height>=44);
   await page.screenshot({path:`/tmp/grove-summary-${device}-${theme}.png`,fullPage:true});
  }
  assert.equal(await page.locator('#summary-reading').getAttribute('maxlength'),'8000');
  for(const id of ['summary-main-idea','summary-details','summary-draft'])assert.equal(await page.locator('#'+id).getAttribute('maxlength'),'2000');
  await page.getByRole('button',{name:'Back to Help',exact:true}).click();
  assert.equal(await page.getByRole('heading',{name:'Help',exact:true}).count(),1);
  assert.deepEqual(errors,[]);assert.ok(requests.every(request=>['GET','HEAD'].includes(request.method)),'Drafts never trigger uploads');
  for(const text of Object.values(draft))assert.ok(requests.every(request=>!request.url.includes(text)&&!request.url.includes(encodeURIComponent(text))),'Draft text stays off request URLs');
  console.log('PASS: summary entry preserves state; typed drafts save/reload per child; storage failures preserve text and the saved draft; stale controls cannot write; normal backup/restore preserves both drafts; clear requires confirmation; no score/reward changes, uploads or raw draft feedback; phone/tablet light/dark layouts.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
