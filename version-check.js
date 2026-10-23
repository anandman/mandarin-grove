const VER='20261023-help-38';
let deferredUpdateVersion='',pendingUpdateVersion='',updateReturnFocus=null;

function deferAppUpdate(){
 deferredUpdateVersion=pendingUpdateVersion;
 document.getElementById('upd')?.close();
 if(updateReturnFocus?.isConnected)updateReturnFocus.focus({preventScroll:true});
}

function showAppUpdate(version){
 if(version===deferredUpdateVersion)return;
 pendingUpdateVersion=version;
 let dialog=document.getElementById('upd');
 // Older cached HTML may still contain the original clickable strip.
 if(dialog&&dialog.tagName!=='DIALOG'){dialog.remove();dialog=null;}
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='upd';
  dialog.setAttribute('aria-labelledby','update-title');
  dialog.setAttribute('aria-describedby','update-description');
  dialog.innerHTML=`<div class="update-card">
   <img class="update-icon" src="icon180.png" width="100" height="100" alt="">
   <h2 id="update-title">Update Mandarin Grove</h2>
   <p id="update-description">A new version is ready!<br>Your saved progress will stay.</p>
   <button id="update-now" class="btn">Update now</button>
   <button id="update-later" class="btn gray">Keep practicing</button>
   <p class="update-hint">In the middle of an answer? Finish it before updating.</p>
  </div>`;
  dialog.addEventListener('cancel',event=>{event.preventDefault();deferAppUpdate();});
  dialog.addEventListener('keydown',event=>{
   if(event.key!=='Tab')return;
   const first=document.getElementById('update-now'),last=document.getElementById('update-later');
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  document.body.append(dialog);
  document.getElementById('update-later').onclick=deferAppUpdate;
  document.getElementById('update-now').onclick=async()=>{
   const button=document.getElementById('update-now');
   button.disabled=true;button.textContent='Updating…';
   document.getElementById('update-later').disabled=true;
   // Refresh downloaded app files only; child profiles and progress stay in localStorage.
   try{if(window.caches)for(const key of await caches.keys())await caches.delete(key);}catch(e){}
   location.replace(location.pathname+'?v='+Date.now());
  };
 }
 if(!dialog.open){updateReturnFocus=document.activeElement;dialog.showModal();document.getElementById('update-now').focus();}
}

async function chkVer(){
 if(VER.startsWith('__'))return;
 try{
  const response=await fetch('version.txt?'+Date.now(),{cache:'no-store'});
  const version=response.ok?(await response.text()).trim():'';
  if(version&&version!==VER)showAppUpdate(version);
 }catch(e){}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)chkVer();});
window.addEventListener('pageshow',chkVer);
setTimeout(chkVer,1500);
