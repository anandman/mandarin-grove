// Browser capability default. Native exports inject their bundled platform adapter.
(function(root){
 if(root.GrovePlatform)return;
 root.GrovePlatform=Object.freeze({platform:'web',ready:()=>Promise.resolve(),persistenceReady:false});
})(typeof window==='undefined'?globalThis:window);
