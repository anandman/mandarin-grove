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
async function activateOfflineUpdate(expectedVersion=''){
 if(!('serviceWorker'in navigator))return;
 const registration=await navigator.serviceWorker.getRegistration();
 if(!registration)return;
 // A downloaded update is usable offline only when it is the requested release.
 let worker=registration.installing||registration.waiting;
 if(!worker||(expectedVersion&&await offlineWorkerVersion(worker)!==expectedVersion)){
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('App update check timed out')),60000);
   Promise.resolve().then(()=>registration.update()).then(result=>{clearTimeout(timer);resolve(result);},error=>{clearTimeout(timer);reject(error);});
  });
  worker=registration.installing||registration.waiting||registration.active;
 }
 if(!worker)return;
 await waitForOfflineWorker(worker,()=>['installed','activated'].includes(worker.state));
 if(expectedVersion&&await offlineWorkerVersion(worker)!==expectedVersion)throw Error('Requested app update is unavailable');
 if(worker.state!=='activated')worker.postMessage({type:'ACTIVATE'});
 await waitForOfflineWorker(worker,()=>worker.state==='activated'&&navigator.serviceWorker.controller===worker);
}
function offlineWorkerVersion(worker){
 if(!worker||typeof MessageChannel==='undefined')return Promise.resolve('');
 return new Promise(resolve=>{
  const channel=new MessageChannel(),finish=version=>{
   clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(typeof version==='string'?version:'');
  },timer=setTimeout(()=>finish(''),2000);
  channel.port1.onmessage=event=>finish(event.data?.version);
  try{worker.postMessage({type:'GET_VERSION'},[channel.port2]);}catch{finish('');}
 });
}
function waitForOfflineWorker(worker,ready){
 return new Promise((resolve,reject)=>{
  const finish=error=>{
   clearTimeout(timer);worker.removeEventListener('statechange',check);
   navigator.serviceWorker.removeEventListener('controllerchange',check);
   if(error)reject(error);else resolve();
  },check=()=>{
   if(worker.state==='redundant')finish(Error('App update installation failed'));
   else if(ready())finish();
  },timer=setTimeout(()=>finish(Error('App update timed out')),60000);
  worker.addEventListener('statechange',check);
  navigator.serviceWorker.addEventListener('controllerchange',check);check();
 });
}
addEventListener('load',installOffline,{once:true});

// GitHub Pages projects share an origin. Maintenance must leave sibling apps alone.
async function clearOfflineApp(){
 const base=new URL('./',location.href),prefix='mandarin-grove-shell-'+(base.pathname==='/'?'':encodeURIComponent(base.pathname)+'-');
 if(typeof caches!=='undefined')for(const key of await caches.keys()){
  if(key.startsWith(prefix)&&/^\d{8}-[a-z0-9-]+$/.test(key.slice(prefix.length)))await caches.delete(key);
 }
 if(navigator.serviceWorker)for(const registration of await navigator.serviceWorker.getRegistrations())if(registration.scope===base.href)await registration.unregister();
}
