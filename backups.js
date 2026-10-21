// Backup files contain the same private, local-only code as clipboard exports.
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
