// Only an explicit Send or Retry sends a report. Learning/profile data stays local.
let feedbackQuestion=null;
const FEEDBACK_KEY='zh_feedback_v1';
const FEEDBACK_CATEGORIES={sound:'Sound seems wrong',meaning:'Meaning is confusing',broken:'Something did not work'};
function feedbackReports(){try{const rows=JSON.parse(localStorage.getItem(FEEDBACK_KEY)||'[]');return Array.isArray(rows)?rows.filter(r=>r&&typeof r==='object').slice(-50):[]}catch{return []}}
function feedbackStore(report){
 const rows=feedbackReports(),index=rows.findIndex(r=>r.id===report.id);
 if(index>=0)rows[index]=report;
 else{
  if(rows.length>=50){const discard=rows.findIndex(r=>!['pending','failed'].includes(r.delivery?.state));if(discard<0)throw Error('storage-full');rows.splice(discard,1);}
  rows.push(report);
 }
 localStorage.setItem(FEEDBACK_KEY,JSON.stringify(rows));
}
function feedbackId(){
 if(window.crypto?.randomUUID)return window.crypto.randomUUID();
 return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,x=>{const n=window.crypto?.getRandomValues?window.crypto.getRandomValues(new Uint8Array(1))[0]&15:Math.random()*16|0;return (x==='x'?n:(n&3|8)).toString(16)});
}
function feedbackContentMetadata(value){
 if(!value||typeof value!=='object')return null;
 const limits={packId:100,itemId:120,version:40,sourceId:100,reviewStatus:100},content={};
 for(const [key,limit]of Object.entries(limits)){if(typeof value[key]!=='string'||!value[key].trim()||value[key].length>limit||/[\u0000-\u001f]/.test(value[key]))return null;content[key]=value[key];}
 return content;
}
function feedbackSnapshot(){
 const c=feedbackQuestion?.card||(feedbackQuestion?.c?feedbackQuestion:null);
 const writing=feedbackQuestion?.writing,content=feedbackContentMetadata(feedbackQuestion?.content);
 const voice=selectedMandarinVoice();
 const request=window.lastSpeechRequest?.character===c?.c?window.lastSpeechRequest:null;
 return {version:typeof VER==='undefined'?'unknown':VER,time:new Date().toISOString(),grade:GR(),
  question:c?{character:c.c,pinyin:c.p,meaning:c.m,mode:feedbackQuestion.mode}:null,
  ...(writing?{writing:{...writing}}:{}),...(content?{content}:{}),
  session:SESS?{kind:SESS.kind||(SESS.cram?'cram':'daily'),question:SESS.i,total:SESS.q.length}:null,
  speech:writing?null:request||{preference:voicePreference(),voice:voice?{name:voice.name,lang:voice.lang,uri:voice.voiceURI}:null,prompt:c?speechText(c):null},
  browser:navigator.userAgent,app:location.origin};
}
function feedbackText(reports){return 'Mandarin Grove feedback\nDelivery status is listed on each report. Copying or downloading does not send it.\n\n'+reports.map(r=>JSON.stringify(r,null,2)).join('\n\n---\n\n')}
function feedbackPayload(report){
 const payload={};for(const key of ['id','category','note','version','time','grade','question','speech','session','writing','content','browser','app'])if(report[key]!==undefined)payload[key]=report[key];if(payload.content){const content=feedbackContentMetadata(payload.content);if(content)payload.content=content;else delete payload.content;}return payload;
}
async function feedbackSendReport(report){
 const pending={...feedbackPayload(report),delivery:{state:'pending'}};
 try{feedbackStore(pending);}catch{return {ok:false,message:'Not sent. This device could not save the report. Ask a grown-up to copy or download it below.'};}
 try{
  if(navigator.onLine===false)throw Error('offline');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
  let response;try{response=await fetch('/api/feedback',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(feedbackPayload(pending)),signal:controller.signal});}finally{clearTimeout(timeout);}
  const receipt=await response.json();
  if(!response.ok||receipt.sent!==true||receipt.id!==pending.id||!Number.isSafeInteger(receipt.receipt)||receipt.receipt<1)throw Error(receipt.error==='feedback-not-configured'?'not-configured':'not-confirmed');
  // A receipt confirms GitHub accepted the report. If saving the receipt fails,
  // keep the server truth and let a later retry find its existing issue by ID.
  try{feedbackStore({...pending,delivery:{state:'sent',receipt:receipt.receipt,sentAt:new Date().toISOString()}});}catch{}
  return {ok:true,message:'Sent to the app maker. Thank you!'};
 }catch(error){
  try{feedbackStore({...pending,delivery:{state:'failed'}});}catch{}
  return {ok:false,message:error.message==='not-configured'?'Not sent yet. Sending is not set up. Your report is saved on this device. You can retry later.':'Not sent or confirmed. Your report is saved on this device. Check your connection and retry.'};
 }
}
function showFeedback(){
 const existing=document.getElementById('feedback-dialog');
 if(existing?.open)return;existing?.remove();
 const snapshot=feedbackSnapshot(),previous=document.activeElement;
 const dialog=document.createElement('dialog');dialog.id='feedback-dialog';dialog.setAttribute('aria-labelledby','feedback-title');
 dialog.innerHTML=`<form method="dialog"><button class="feedback-close" aria-label="Close feedback">✕</button></form>
 <h2 id="feedback-title">Report a problem</h2>
 <fieldset class="feedback-categories"><legend>What happened?</legend>${Object.entries(FEEDBACK_CATEGORIES).map(([key,label])=>`<button type="button" class="btn gray feedback-category" data-category="${key}" aria-pressed="false">${label}</button>`).join('')}</fieldset>
 <label>Anything else? (optional)<textarea id="feedback-note" maxlength="2000" placeholder="You can tell us more, or just send."></textarea></label>
 <p class="reading-note">Send shares this problem and the activity and voice details privately with the app maker. Please leave out names or other personal information.</p>
 <button class="btn" id="feedback-send" disabled>Send report</button><p id="feedback-status" role="status" aria-live="polite"></p>
 <div id="feedback-pending" hidden><p id="feedback-pending-count"></p><button class="btn gray" id="feedback-retry">Retry saved report</button></div>
 <details id="feedback-manual"><summary>Grown-ups: saved reports &amp; manual sharing</summary>
 <button class="btn gray" id="feedback-save">Save only on this device</button>
 <details id="feedback-details"><summary>Report details</summary><textarea id="feedback-output" aria-label="Feedback report" readonly></textarea></details>
 <div class="feedback-actions"><button class="btn gray" id="feedback-copy">Copy report</button><button class="btn gray" id="feedback-share">Share report</button><button class="btn gray" id="feedback-download">Download report</button></div>
 <button class="progress-link" id="feedback-all">View saved feedback</button></details>`;
 document.body.append(dialog);dialog.showModal();
 const note=dialog.querySelector('#feedback-note'),output=dialog.querySelector('#feedback-output'),status=dialog.querySelector('#feedback-status');
 const send=dialog.querySelector('#feedback-send'),retry=dialog.querySelector('#feedback-retry'),categories=[...dialog.querySelectorAll('[data-category]')];
 let id=feedbackId(),category=null,saved=false,all=false,locked=false,busy=false,delivered=false;
 const current=()=>({...snapshot,id,category,note:note.value.trim()});
 const pending=()=>feedbackReports().filter(r=>r.id&&FEEDBACK_CATEGORIES[r.category]&&['pending','failed'].includes(r.delivery?.state));
 const refresh=()=>{
  output.value=feedbackText(all?feedbackReports():[locked?feedbackReports().find(r=>r.id===id)||current():current()]);
  const unsent=pending(),count=unsent.length;dialog.querySelector('#feedback-pending').hidden=!count;retry.hidden=locked&&count===1&&unsent[0].id===id;dialog.querySelector('#feedback-pending-count').textContent=`${count} ${count===1?'report':'reports'} not sent or confirmed on this device.`;
 };refresh();
 const setBusy=value=>{busy=value;send.disabled=value||!category||delivered;retry.disabled=value;note.disabled=locked;dialog.querySelector('#feedback-save').disabled=locked||value||saved;categories.forEach(button=>button.disabled=locked);};
 categories.forEach(button=>button.onclick=()=>{if(locked)return;category=button.dataset.category;categories.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));send.disabled=false;saved=false;dialog.querySelector('#feedback-save').disabled=false;all=false;refresh();});
 note.oninput=()=>{saved=false;all=false;dialog.querySelector('#feedback-save').disabled=false;refresh()};
 send.onclick=async()=>{
  if(busy||!category)return;locked=true;setBusy(true);status.textContent='Sending…';
  const result=await feedbackSendReport(current());delivered=result.ok;status.textContent=result.message;setBusy(false);send.textContent=result.ok?'Report sent':'Retry report';refresh();
 };
 retry.onclick=async()=>{
  if(busy)return;const report=pending()[0];if(!report)return;setBusy(true);status.textContent='Sending saved report…';
  const result=await feedbackSendReport(report);if(report.id===id&&result.ok){delivered=true;send.textContent='Report sent';}status.textContent=result.message;setBusy(false);refresh();
 };
 dialog.querySelector('#feedback-save').onclick=()=>{
  if(saved)return;
  if(locked||busy)return;
  if(!category&&!note.value.trim()){status.textContent='Choose a problem or add a note first.';return;}
  try{feedbackStore({...current(),delivery:{state:'local'}});saved=true;dialog.querySelector('#feedback-save').disabled=true;status.textContent='Saved on this device. Nothing has been sent.';refresh();}catch{status.textContent='Could not save here. Copy or download the report instead.';}
 };
 dialog.querySelector('#feedback-all').onclick=()=>{all=true;refresh();dialog.querySelector('#feedback-details').open=true;status.textContent=`${feedbackReports().length} saved reports on this device (latest 50). Delivery status is included. Copy, download or share them together.`;};
 dialog.querySelector('#feedback-copy').onclick=async()=>{
  refresh();try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(output.value);status.textContent='Copied. Paste the report into a message or this chat.';}
  catch{dialog.querySelector('#feedback-details').open=true;output.focus();output.select();status.textContent='Automatic copying is unavailable here. Press and hold the selected report to copy, or use Download report.';}
 };
 const share=dialog.querySelector('#feedback-share');share.hidden=!navigator.share;
 share.onclick=async()=>{refresh();try{await navigator.share({title:'Mandarin Grove feedback',text:output.value});status.textContent='Share sheet closed. Nothing was sent automatically by the app.';}catch(e){if(e.name!=='AbortError')status.textContent='Sharing is unavailable. Copy or download the report instead.';}};
 dialog.querySelector('#feedback-download').onclick=()=>{refresh();const url=URL.createObjectURL(new Blob([output.value],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='mandarin-grove-feedback.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);};
 dialog.onclose=()=>{dialog.remove();previous?.focus()};
 categories[0].focus();
}
