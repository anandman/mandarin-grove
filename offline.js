// Offline public resources are independent of profiles, progress and saved public readings.
let OFFLINE_STATUS='loading',OFFLINE_REGISTRATION=null;
function setOfflineStatus(status){OFFLINE_STATUS=status;dispatchEvent(new Event('grove-offline-status'));}
async function installOffline(){
 if(!('serviceWorker'in navigator)){setOfflineStatus('unavailable');return;}
 setOfflineStatus('loading');
 try{
  const registration=await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'});OFFLINE_REGISTRATION=registration;
  const observe=worker=>{if(!worker)return;const refresh=()=>{
   if(worker.state==='installed'||worker.state==='activated')setOfflineStatus('ready');
   else if(worker.state==='redundant')setOfflineStatus(registration.active?'ready':'error');
  };worker.addEventListener('statechange',refresh);refresh();};
  registration.addEventListener('updatefound',()=>observe(registration.installing));
  if(registration.active||registration.waiting)setOfflineStatus('ready');else observe(registration.installing);
 }catch{setOfflineStatus('error');}
}
async function activateOfflineUpdate(){
 if(!('serviceWorker'in navigator))return;
 const registration=await navigator.serviceWorker.getRegistration();
 if(!registration)return;
 await registration.update();
 if(registration.installing){await new Promise(resolve=>{const w=registration.installing,finish=()=>{if(['installed','activated','redundant'].includes(w.state))resolve();};w.addEventListener('statechange',finish);finish();setTimeout(resolve,10000);});}
 if(registration.waiting)await new Promise(resolve=>{
  const done=()=>{navigator.serviceWorker.removeEventListener('controllerchange',done);resolve();};
  navigator.serviceWorker.addEventListener('controllerchange',done);registration.waiting.postMessage({type:'ACTIVATE'});setTimeout(done,5000);
 });
}
addEventListener('load',installOffline,{once:true});
