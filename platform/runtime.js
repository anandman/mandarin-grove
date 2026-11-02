// Browser capability default. Native exports inject their bundled platform adapter.
(function(root){
 if(root.GrovePlatform)return;
 if(typeof document!=='undefined'&&document.documentElement?.dataset.groveNative==='true'){
  root.GrovePlatform=Object.freeze({platform:'native-unavailable',ready:()=>Promise.reject(Error('The native bridge is unavailable. Existing progress has been kept.')),persistenceReady:false});return;
 }
 root.GrovePlatform=Object.freeze({platform:'web',ready:()=>Promise.resolve(),persistenceReady:false});
})(typeof window==='undefined'?globalThis:window);
