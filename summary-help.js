// Fixed planning prompts and per-child drafts. No answer checking or uploads.
function showSummaryHelp(){
 screen();setPageBack(showHomeworkHelp,'Back to Help');SESS=null;CRAM=null;delete document.body.dataset.study;feedbackQuestion=null;
 const owner=PR.cur;
 A.innerHTML=`<section class="summary-help" id="summary-help" aria-labelledby="summary-title">
  <div class="writing-heading"><span class="writing-tree">${groveTree('writing')}</span><div><h1 id="summary-title">Plan a summary</h1><p>Find the big idea, then tell it in your own words.</p></div></div>
  <p class="reading-note">A planning guide; it does not check your answer. You can keep your reading open in your book.</p>
  <details class="summary-reading"><summary>Add the reading (optional)</summary><div class="summary-field"><label for="summary-reading">Reading (optional)</label><p class="reading-note" id="summary-reading-help">Paste it here if it helps you look back. You can leave this empty.</p><textarea id="summary-reading" rows="5" maxlength="8000" lang="zh-Hans" aria-describedby="summary-reading-help" placeholder="Your reading, if you want it here…"></textarea></div></details>
  <div class="summary-steps">
   <div class="summary-field"><span class="summary-step-label">1 · Find the big idea</span><label for="summary-main-idea">Main idea</label><p class="reading-note" id="summary-main-idea-help">Who or what is this mostly about? What is the most important thing the reading tells you?</p><textarea id="summary-main-idea" rows="2" maxlength="2000" lang="zh-Hans" aria-describedby="summary-main-idea-help"></textarea></div>
   <div class="summary-field"><span class="summary-step-label">2 · Choose what matters</span><label for="summary-details">Key details</label><p class="reading-note" id="summary-details-help">Choose two or three details that help explain the main idea. Leave out small details you do not need.</p><textarea id="summary-details" rows="3" maxlength="2000" lang="zh-Hans" aria-describedby="summary-details-help"></textarea></div>
   <div class="summary-field"><span class="summary-step-label">3 · Put it together</span><label for="summary-draft">My summary</label><p class="reading-note" id="summary-draft-help">Use your own words to connect the main idea and key details. Read it back: will someone understand the reading from your summary?</p><textarea id="summary-draft" rows="4" maxlength="2000" lang="zh-Hans" aria-describedby="summary-draft-help"></textarea></div>
  </div>
  <div class="summary-footer"><p class="reading-note" id="summary-save-status" role="status">Your draft saves on this device as you type, for this child. It is included in your normal backup.</p><button type="button" class="btn gray" id="summary-clear">Clear draft</button></div>

 </section>`;
 const root=$('summary-help'),status=root.querySelector('#summary-save-status'),clear=root.querySelector('#summary-clear');
 const fields={reading:root.querySelector('#summary-reading'),mainIdea:root.querySelector('#summary-main-idea'),details:root.querySelector('#summary-details'),summary:root.querySelector('#summary-draft')};
 const active=()=>owner&&root.isConnected&&$('summary-help')===root&&PR.cur===owner;
 const homework=()=>S.homeworkHelp&&typeof S.homeworkHelp==='object'&&!Array.isArray(S.homeworkHelp)?S.homeworkHelp:{};
 const saved=homework().summary;
 for(const [key,input]of Object.entries(fields))input.value=typeof saved?.[key]==='string'?saved[key].slice(0,input.maxLength):'';
 const updateClear=()=>{clear.disabled=!Object.values(fields).some(input=>input.value.length);};
 for(const input of Object.values(fields))input.addEventListener('input',()=>{
  if(!active())return;
  const draft={};
  for(const [key,field]of Object.entries(fields))draft[key]=field.value.slice(0,field.maxLength);
  S.homeworkHelp={...homework(),summary:draft};updateClear();
  try{
   save();status.textContent='Draft saved on this device, for this child. Included in your normal backup.';
  }catch{
   // Keep the user's draft available to retry; failed destructive changes use save's durable rollback.
   S.homeworkHelp={...homework(),summary:draft};
   status.textContent='Could not save on this device. Your text is still here. Keep this page open and type again to retry.';
  }
 });
 clear.onclick=()=>{
  if(!active()||!confirm('Clear this summary draft? The reading, main idea, key details and summary will be removed from this device.'))return;
  if(!active())return;
  const previous=S.homeworkHelp,remaining={...homework()};delete remaining.summary;
  S.homeworkHelp=remaining;
  try{save();}catch{
   S.homeworkHelp=previous;
   status.textContent='Could not clear the saved draft on this device. Your text is still here. Keep this page open and try again.';
   return;
  }
  for(const input of Object.values(fields))input.value='';
  updateClear();status.textContent='Draft cleared on this device.';fields.mainIdea.focus();
 };
 updateClear();
}
