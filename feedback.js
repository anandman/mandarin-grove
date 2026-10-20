// Reports stay in this browser until the user explicitly copies, downloads or shares them.
let feedbackQuestion=null;
const FEEDBACK_KEY='zh_feedback_v1';
function feedbackReports(){try{const rows=JSON.parse(localStorage.getItem(FEEDBACK_KEY)||'[]');return Array.isArray(rows)?rows.slice(-50):[]}catch{return []}}
function feedbackSnapshot(){
 const c=feedbackQuestion?.card;
 const voice=selectedMandarinVoice();
 const request=window.lastSpeechRequest?.character===c?.c?window.lastSpeechRequest:null;
 return {version:typeof VER==='undefined'?'unknown':VER,time:new Date().toISOString(),grade:GR(),
  question:c?{character:c.c,pinyin:c.p,meaning:c.m,mode:feedbackQuestion.mode}:null,
  session:SESS?{kind:SESS.cram?'cram':'daily',question:SESS.i,total:SESS.q.length}:null,
  speech:request||{preference:voicePreference(),voice:voice?{name:voice.name,lang:voice.lang,uri:voice.voiceURI}:null,prompt:c?speechText(c):null},
  browser:navigator.userAgent,app:location.origin};
}
function feedbackText(reports){return 'Mandarin Grove feedback\nNothing was sent automatically.\n\n'+reports.map(r=>JSON.stringify(r,null,2)).join('\n\n---\n\n')}
function showFeedback(){
 const existing=document.getElementById('feedback-dialog');
 if(existing?.open)return;existing?.remove();
 const snapshot=feedbackSnapshot(),previous=document.activeElement;
 const dialog=document.createElement('dialog');dialog.id='feedback-dialog';dialog.setAttribute('aria-labelledby','feedback-title');
 dialog.innerHTML=`<form method="dialog"><button class="feedback-close" aria-label="Close feedback">✕</button></form>
 <h2 id="feedback-title">Report a problem</h2>
 <p>What sounded wrong or didn’t work?</p><label>Your note<textarea id="feedback-note" maxlength="2000" placeholder="For example: I heard màn, but the answer says mǎn."></textarea></label>
 <p class="reading-note">Question and voice details are included. Saved only in this browser—not sent to anyone. You can share the report with a parent to paste into ChatGPT.</p>
 <button class="btn" id="feedback-save">Save on this device</button><p id="feedback-status" role="status"></p>
 <details><summary>Report details</summary><textarea id="feedback-output" aria-label="Feedback report" readonly></textarea></details>
 <div class="feedback-actions"><button class="btn gray" id="feedback-copy">Copy report</button><button class="btn gray" id="feedback-share">Share report</button><button class="btn gray" id="feedback-download">Download report</button></div>
 <button class="progress-link" id="feedback-all">View saved feedback</button>`;
 document.body.append(dialog);dialog.showModal();
 const note=dialog.querySelector('#feedback-note'),output=dialog.querySelector('#feedback-output'),status=dialog.querySelector('#feedback-status');
 let saved=false,all=false;
 const current=()=>({...snapshot,note:note.value.trim()});
 const refresh=()=>{output.value=feedbackText(all?feedbackReports():[current()]);};refresh();
 note.oninput=()=>{saved=false;all=false;dialog.querySelector('#feedback-save').disabled=false;refresh()};
 dialog.querySelector('#feedback-save').onclick=()=>{
  if(saved)return;
  if(!note.value.trim()){status.textContent='Add a note about the problem first.';note.focus();return;}
  try{localStorage.setItem(FEEDBACK_KEY,JSON.stringify([...feedbackReports(),current()].slice(-50)));saved=true;dialog.querySelector('#feedback-save').disabled=true;status.textContent='Saved on this device. Nothing has been sent.';}catch{status.textContent='Could not save here. Copy or download the report instead.';}
 };
 dialog.querySelector('#feedback-all').onclick=()=>{all=true;refresh();dialog.querySelector('details').open=true;status.textContent=`${feedbackReports().length} saved reports on this device (latest 50). Copy, download or share them together.`;};
 dialog.querySelector('#feedback-copy').onclick=async()=>{
  refresh();try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(output.value);status.textContent='Copied. Paste the report into a message or this chat.';}
  catch{dialog.querySelector('details').open=true;output.focus();output.select();status.textContent='Automatic copying is unavailable here. Press and hold the selected report to copy, or use Download report.';}
 };
 const share=dialog.querySelector('#feedback-share');share.hidden=!navigator.share;
 share.onclick=async()=>{refresh();try{await navigator.share({title:'Mandarin Grove feedback',text:output.value});status.textContent='Share sheet closed. Nothing was sent automatically by the app.';}catch(e){if(e.name!=='AbortError')status.textContent='Sharing is unavailable. Copy or download the report instead.';}};
 dialog.querySelector('#feedback-download').onclick=()=>{refresh();const url=URL.createObjectURL(new Blob([output.value],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='mandarin-grove-feedback.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);};
 dialog.onclose=()=>{dialog.remove();previous?.focus()};
 note.focus();
}
