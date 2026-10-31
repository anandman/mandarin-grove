// Cache only the explicit public app shell. Never cache feedback, learner records or remote sources.
const VERSION='20261030-feedback-77',BASE=new URL('./',self.location.href),ROOT=BASE.pathname,
 SHELL_PREFIX='mandarin-grove-shell-'+(ROOT==='/'?'':encodeURIComponent(ROOT)+'-'),SHELL=SHELL_PREFIX+VERSION;
let allowed=null;
async function assets(){
 if(allowed)return allowed;
 const cache=await caches.open(SHELL),response=await cache.match('offline-assets.json')||await fetch('offline-assets.json',{cache:'no-store'});
 const list=await response.json();
 if(!Array.isArray(list)||list.length>150||!list.includes('index.html')||list.some(p=>typeof p!=='string'||!/^[-a-zA-Z0-9_/.]+$/.test(p)||p.includes('..')||p.startsWith('/')||/^(api|docs|audio)\//.test(p)))throw Error('Invalid offline manifest');
 return allowed=new Set(list);
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const current=async()=>{const r=await fetch('version.txt',{cache:'no-store'});if(!r.ok||(await r.text()).trim()!==VERSION)throw Error('Deployment changed');};
 try{
  await current();const list=await assets(),cache=await caches.open(SHELL);
  await cache.addAll([...list].map(p=>new Request(p,{cache:'reload'})));await current();
 }catch(error){await caches.delete(SHELL);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(ROOT))return;
 const path=url.pathname.slice(ROOT.length)||'index.html';
 if(path==='version.txt'||path.startsWith('api/'))return;
 event.respondWith((async()=>{
  const requested=url.searchParams.get('v');
  if(path!=='index.html'&&requested&&/^\d{8}-[a-z0-9-]+$/.test(requested)&&requested!==VERSION){
   // Another tab may still be loading an older document when this worker activates.
   // Static hosting ignores ?v=, so a network fallback could silently return the wrong code.
   const oldName=SHELL_PREFIX+requested;
   if(await caches.has(oldName)){
    const old=await caches.open(oldName),manifest=await old.match('offline-assets.json');
    if(manifest&&(await manifest.json()).includes(path)){const saved=await old.match(path);if(saved)return saved;}
   }
   return new Response('This page version is unavailable. Refresh the page to load the complete current app.',{status:409,headers:{'Content-Type':'text/plain'}});
  }
  const list=await assets();
  if(!list.has(path))return fetch(request);
  const cache=await caches.open(SHELL),saved=await cache.match(path);return saved||fetch(request);
 })());
});
