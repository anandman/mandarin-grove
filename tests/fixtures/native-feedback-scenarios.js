// Explicit synthetic-device fixture. Never included in a shipped app export.
(function(root){
 const copy=v=>JSON.parse(JSON.stringify(v)),equal=(a,b,message)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(message);};
 const check=(value,message)=>{if(!value)throw Error(message);};
 const wait=async predicate=>{const end=Date.now()+10000;while(Date.now()<end){if(await predicate())return;await new Promise(r=>setTimeout(r,25));}throw Error('Synthetic feedback wait timed out');};
 let prior,priorReports,report,calls=[],wire;
 async function guard(){await GROVE_STARTED;const registry=await GROVE_REPOSITORY.peekRegistry();check(registry.list.length&&registry.list.every(p=>p.id.startsWith('synthetic-')),'Dedicated synthetic learners only');check((await feedbackReports()).length<40,'Keep room without evicting prior reports');}
 async function unchanged(){equal(await backup(),prior,'Learner backup changed');const rows=await feedbackReports();for(const original of priorReports)equal(rows.find(r=>r.id===original.id),original,'Prior raw report changed');}
 async function previewCancel(){
  await guard();prior=await backup();priorReports=await feedbackReports();
  document.getElementById('feedback-dialog')?.close();await new Promise(r=>setTimeout(r,0));
  await showFeedback({category:'broken',note:'Synthetic native feedback proof',context:{writing:{input:'PRIVATE_WRITING_DRAFT',idea:'PRIVATE_IDEA'}}});
  document.getElementById('feedback-send').click();await wait(()=>document.getElementById('feedback-preview'));
  const dialog=document.getElementById('feedback-preview'),payload=JSON.parse(dialog.querySelector('pre').textContent);
  check(!JSON.stringify(payload).includes('PRIVATE'),'Private writing leaked into preview');equal(payload.platform,GrovePlatform.platform,'Platform mismatch');
  check(document.activeElement.id==='feedback-preview-cancel','Cancel must receive initial focus');
  dialog.querySelector('summary').click();check(dialog.scrollWidth<=dialog.clientWidth+1,'Preview overflows');
  document.getElementById('feedback-preview-cancel').click();await wait(()=>!document.getElementById('feedback-preview')&&document.activeElement.id==='feedback-send');
  equal(await feedbackReports(),priorReports,'Cancel stored a report');await unchanged();return {preview:payload,cancelNoWrite:true};
 }
 async function beginPending(){
  check(!!window.GroveNativeTest,'Internal synthetic package required');await previewCancel();
  // Positive delivery is mocked while the actual emulator stays offline.
  Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});
  document.getElementById('feedback-send').click();await wait(()=>document.getElementById('feedback-preview'));document.getElementById('feedback-preview-send').click();
  await wait(()=>document.getElementById('feedback-status').textContent.includes('Not sent or confirmed'));
  const rows=await feedbackReports();report=rows.find(r=>!priorReports.some(p=>p.id===r.id));check(!!report,'Offline raw report missing');
  equal(report.delivery.state,'failed','Offline state');equal(report.writing.input,'PRIVATE_WRITING_DRAFT','Raw draft missing');
  report.futureLocal={keep:['PRIVATE_FUTURE',null,{opaque:true}]};report.delivery.futureDelivery={keep:true};await GROVE_REPOSITORY.saveReport(report);
  document.getElementById('feedback-dialog').close();await new Promise(r=>setTimeout(r,0));
  Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});
  GroveNativeTest.feedbackRequest=options=>{calls.push(copy(options));wire=copy(options.data);return new Promise(()=>{});};
  // Use the actual UI retry for this retained row, preserving older reports too.
  await showFeedback();const retry=document.getElementById('feedback-retry');retry.click();await wait(()=>document.getElementById('feedback-preview'));
  check(JSON.parse(document.querySelector('#feedback-preview pre').textContent).id===report.id,'Expected newest synthetic pending report');document.getElementById('feedback-preview-send').click();
  await wait(async()=>calls.length===1&&(await feedbackReports()).find(r=>r.id===report.id)?.delivery.state==='pending');
  check(!JSON.stringify(wire).includes('PRIVATE'),'Private raw data leaked');await unchanged();
  return {prior,priorReports,report,wire,pending:await feedbackReports(),calls:copy(calls),positiveNavigatorOverride:true};
 }
 async function recoverAndRetry(state){
  await guard();check(!!window.GroveNativeTest,'Internal synthetic package required');prior=state.prior;priorReports=state.priorReports;report=state.report;
  equal((await feedbackReports()).find(r=>r.id===report.id).delivery.state,'pending','Pending report did not survive process death');
  calls=[];GroveNativeTest.feedbackRequest=async options=>{calls.push(copy(options));return {status:201,data:{sent:true,id:options.data.id,receipt:612},url:options.url};};
  Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});await new Promise(r=>setTimeout(r,300));equal(calls.length,0,'Recovery automatically uploaded');
  await showFeedback();document.getElementById('feedback-retry').click();await wait(()=>document.getElementById('feedback-preview'));
  equal(JSON.parse(document.querySelector('#feedback-preview pre').textContent),state.wire,'Retry preview changed');document.getElementById('feedback-preview-cancel').click();await wait(()=>!document.getElementById('feedback-preview')&&!document.getElementById('feedback-retry').disabled);equal(calls.length,0,'Cancel uploaded');
  document.getElementById('feedback-retry').click();await wait(()=>document.getElementById('feedback-preview'));document.getElementById('feedback-preview-send').click();
  await wait(()=>document.getElementById('feedback-status').textContent.includes('Sent to the app maker'));
  equal(calls.length,1,'Retry delivery count');equal(calls[0].data,state.wire,'Same ID/payload required');
  const after=(await feedbackReports()).find(r=>r.id===report.id);equal(after.futureLocal,report.futureLocal,'Raw unknown lost');equal(after.delivery.futureDelivery,report.delivery.futureDelivery,'Delivery unknown lost');equal(after.writing,report.writing,'Raw draft lost');equal(after.delivery.state,'sent','Receipt not durable');
  await unchanged();return {sameId:true,noAutoUpload:true,rawUnknowns:true,exactProgress:true,report:after,calls};
 }
 async function refusedPendingSave(){
  await guard();check(!!window.GroveNativeTest,'Internal synthetic package required');prior=await backup();priorReports=await feedbackReports();let count=0;
  GroveNativeTest.feedbackRequest=async()=>{count++;throw Error('Should never reach transport');};Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});
  const connection=GroveNativeTest.connection,max=(await connection.query('PRAGMA max_page_count')).values[0].max_page_count,pages=(await connection.query('PRAGMA page_count')).values[0].page_count;
  const raw={id:crypto.randomUUID(),category:'broken',note:'Synthetic refused local report',version:VER,time:new Date().toISOString(),future:'保'.repeat(1000000)};
  try{await connection.query('PRAGMA max_page_count='+pages);const result=await feedbackSendReport(raw,{payload:GrovePlatform.prepareFeedback(raw),epoch:GrovePlatform.feedbackEpoch});check(!result.ok&&result.message.includes('could not save'),'Expected refused local save');equal(count,0,'Failed local save made a network request');equal(await feedbackReports(),priorReports,'Refused local save changed reports');await unchanged();return {sqliteFull:true,noNetwork:true,exactProgress:true};}
  finally{await connection.query('PRAGMA max_page_count='+max);}
 }
 root.GroveFeedbackScenarios={previewCancel,beginPending,recoverAndRetry,refusedPendingSave};
})(window);
