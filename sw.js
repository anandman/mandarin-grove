// Cache only the explicit public app shell. Never cache feedback, learner records or remote sources.
const VERSION='20261025-supported-70',SHELL='mandarin-grove-shell-'+VERSION;
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
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname==='/version.txt')return;
 event.respondWith((async()=>{
  const path=url.pathname==='/'?'index.html':url.pathname.slice(1),list=await assets();
  if(!list.has(path))return fetch(request);
  const cache=await caches.open(SHELL),saved=await cache.match(path);return saved||fetch(request);
 })());
});
