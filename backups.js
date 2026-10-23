// Backup files contain the same private, local-only code as clipboard exports.
const GROVE_CODEC={
 decodeUtf8:code=>new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(code),c=>c.charCodeAt(0))),
 encodeUtf8:text=>{let bytes='';for(const byte of new TextEncoder().encode(text))bytes+=String.fromCharCode(byte);return btoa(bytes);}
};
function prepareWebProgress(value,now,profile){
 const grade=profile?.gr||'2';value.cfg.quiz=canonicalQuiz(value.cfg.quiz||'',QU(grade));
 if(value.cfg.past)value.cfg.past=value.cfg.past.map(p=>({...p,q:canonicalQuiz(p.q,QU(grade))}));
 refreshRewardState(value,grade,now);creditLegacyStars(value,now);return value;
}
const GROVE_REPOSITORY=GroveStorage.createRepository({storage:localStorage,codec:GROVE_CODEC,migrate:prepareWebProgress});
function showStorageFailure(error){
 let status=document.getElementById('progress-storage-status');
 if(!status){status=document.createElement('p');status.id='progress-storage-status';status.className='wrap reading-note';status.setAttribute('role','alert');document.getElementById('app')?.before(status);}
 status.textContent='Could not save progress. '+error.message+' Keep this page open and try again.';
}
function clearStorageFailure(){document.getElementById('progress-storage-status')?.remove();}
function showProgressRecovery(error,{imported=false}={}){
 const app=document.getElementById('app');app.replaceChildren();
 const title=document.createElement('h1');title.textContent=imported?'Your backup was saved but could not be opened':'Your saved progress was kept unchanged';
 const note=document.createElement('p');note.className='reading-note';note.textContent=(imported?'The imported progress is on this device, but this page could not open it. ':'This browser could not read or recover it. ')+error.message+' You can download a recovery copy before reloading or getting help.';
 const download=document.createElement('button');download.className='btn';download.textContent='Download recovery copy';download.onclick=()=>{
  const entries=Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('zh_')||k==='owenzh_v1').map(k=>[k,localStorage.getItem(k)]));
  const url=URL.createObjectURL(new Blob([JSON.stringify({format:'mandarin-grove-recovery-v1',storage:entries})],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='mandarin-grove-recovery.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
 };
 const reload=document.createElement('button');reload.className='btn gray';reload.textContent='Reload';reload.onclick=()=>location.reload();app.append(title,note,download,reload);
}
// Compare durable progress without moving any caller's three-way merge baselines.
function backupDeviceStamp(){
 return JSON.stringify(Object.keys(localStorage).filter(key=>key==='zh_profiles'||key.startsWith('zh_p_')||key==='zh_backup_meta_v1'||key==='owenzh_v1').sort().map(key=>[key,localStorage.getItem(key)]));
}
function backupDeviceSummary(){
 const before=backupDeviceStamp(),registry=GROVE_REPOSITORY.peekRegistry(),stamp=backupDeviceStamp();
 if(before!==stamp)throw Error('Device progress changed while preparing the comparison. Please try again.');
 return {registry,stamp};
}
function openBackupRestore(overlay){
 const container=document.getElementById('grx');container.replaceChildren();
 const field=document.createElement('textarea');field.id='grt';field.setAttribute('aria-label','Paste the backup code');field.placeholder='Paste the backup code here';field.style.cssText='width:100%;box-sizing:border-box;height:90px;margin-top:10px;font-size:16px;padding:10px';
 const preview=document.createElement('div');preview.id='grpv';preview.setAttribute('aria-live','polite');
 const cancel=document.createElement('button');cancel.id='grc';cancel.className='btn gray';cancel.textContent='Cancel';cancel.onclick=()=>{container.replaceChildren();document.getElementById('grest')?.focus({preventScroll:true});};container.append(field,preview,cancel);field.focus();
 field.oninput=()=>{
  preview.replaceChildren();if(!field.value.trim())return;let candidate;
  try{candidate=GROVE_REPOSITORY.previewBackup(field.value);}catch{preview.textContent='That code did not work. Check that you copied all of it.';return;}
  let device;try{device=backupDeviceSummary();}catch(error){preview.textContent='Could not read current device progress for comparison. '+error.message+' Nothing has been replaced.';return;}
  const comparison=document.createElement('div');comparison.id='backup-comparison';
  const current=document.createElement('section'),currentTitle=document.createElement('h4'),currentNames=document.createElement('p');currentTitle.textContent='Current device · '+device.registry.list.length+' '+(device.registry.list.length===1?'child':'children');currentNames.textContent=device.registry.list.map(p=>p.name||'Learner').join(', ');current.append(currentTitle,currentNames);
  const incoming=document.createElement('section'),label=document.createElement('h4');label.textContent='This backup · '+candidate.registry.list.length+' '+(candidate.registry.list.length===1?'child':'children');const list=document.createElement('ul');
  for(const profile of candidate.registry.list){const item=document.createElement('li');item.textContent=(profile.av||'')+' '+(profile.name||'Learner')+' ('+BKW(profile,candidate.rawProfiles[profile.id])+')';list.append(item);}
  const question=document.createElement('p');question.textContent="Replace all saved progress on this device with this backup. Children missing from the backup will be removed from this device. Names, history, rewards, drafts and paused rounds will be replaced. Your saved backup files stay unchanged.";
  const replace=document.createElement('button');replace.id='grr';replace.className='btn';replace.textContent='Replace all device progress';
  replace.onclick=()=>{
   let imported=false;
   try{
    if(device.stamp!==backupDeviceStamp()){preview.replaceChildren();const warning=document.createElement('p');warning.setAttribute('role','alert');warning.textContent='Device progress changed after this preview. Nothing has been replaced. Refresh the comparison and review it before continuing.';const refresh=document.createElement('button');refresh.className='btn gray';refresh.textContent='Refresh comparison';refresh.onclick=()=>field.oninput();preview.append(warning,refresh);refresh.focus();return;}
    const registry=GROVE_REPOSITORY.importBackup(GroveBackup.encodeBackup(candidate,GROVE_CODEC));imported=true;PR=registry;GROVE_SAVED_REGISTRY=JSON.parse(JSON.stringify(PR));loadS({persist:false});clearStorageFailure();home();overlay.remove();pop('Restored ✓');}
   catch(error){
    if(imported){GROVE_PROGRESS_READY=false;NAV++;overlay.remove();showProgressRecovery(error,{imported:true});}
    else{preview.replaceChildren();preview.textContent='Could not restore progress. '+error.message+' Your previous progress has been kept for recovery.';}
   }
  };
  incoming.append(label,list);comparison.append(current,incoming);
  const exportFirst=document.createElement('button');exportFirst.className='btn gray';exportFirst.textContent='Download current backup first';exportFirst.onclick=()=>{try{downloadBackupFile();}catch(error){const status=document.getElementById('backup-status');if(status)status.textContent='Could not prepare a current backup. '+error.message+' Your progress has not been replaced.';}};
  preview.append(comparison,question,exportFirst,replace);
 };
}
function selectBackupCode(textarea){
 textarea.focus();textarea.select();textarea.setSelectionRange(0,textarea.value.length);
 textarea.scrollIntoView({block:'nearest'});
}
function backupCopyFallback(code){
 const container=$('gcf');
 container.innerHTML=`<p role="status" class="reading-note">Automatic copying is unavailable. Download a backup file, or select the code and use Copy.</p><textarea readonly aria-label="Backup code" spellcheck="false" autocapitalize="off" style="width:100%;box-sizing:border-box;height:110px;font:16px monospace;padding:8px;border:2px solid var(--ln);border-radius:12px;user-select:text;-webkit-user-select:text;-webkit-touch-callout:default"></textarea><button class="btn gray" id="gselect">Select backup code</button>`;
 const textarea=container.querySelector('textarea');textarea.value=code;
 $('gselect').onclick=()=>selectBackupCode(textarea);
 selectBackupCode(textarea);
}
function downloadBackupFile(){
 const url=URL.createObjectURL(new Blob([backup()],{type:'text/plain;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='mandarin-grove-backup-'+today()+'.txt';
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 $('backup-status').textContent='Backup file prepared. Keep it in Files or Downloads; it includes every child’s progress and names.';
}
async function restoreBackupFile(input){
 const file=input.files?.[0];if(!file)return;
 try{
  const code=await file.text();
  if(!input.isConnected)return;
  $('grest').click();const field=$('grt');field.value=code;field.dispatchEvent(new Event('input'));
  $('backup-status').textContent='File opened. Check the profiles below before choosing Replace.';
  $('grpv').scrollIntoView({block:'nearest'});
 }catch{
  const status=$('backup-status');if(status)status.textContent='Could not read that file. Try again, or paste its backup code.';
 }finally{input.value='';}
}
