// Public reading text only. No learner records, scores, drafts or uploads.
(function(root){
 'use strict';
 const MAX_BYTES=65536,MAX_SAVED=32,MAX_CACHE_BYTES=524288,CACHE='mandarin-grove-public-readings-v1';
 const licenses={'CC-BY-3.0':'https://creativecommons.org/licenses/by/3.0/','CC-BY-2.0-FR':'https://creativecommons.org/licenses/by/2.0/fr/'};
 const text=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max&&!/[\u0000-\u001f<>]/.test(s);
 function endpoint(item){
  if(item.kind==='story')return 'https://raw.githubusercontent.com/global-asp/global-asp/'+item.revision+'/'+item.path.split('/').map(encodeURIComponent).join('/');
  return 'https://api.tatoeba.org/v1/sentences/'+item.remoteId+'?'+new URLSearchParams({'showtrans:lang':'eng','showtrans:is_direct':'yes','showtrans:is_unapproved':'no'});
 }
 function createLibrary(input,options={}){
  const catalog=JSON.parse(JSON.stringify(input)),items=catalog?.items;
  if(catalog?.schemaVersion!==1||catalog.id!=='grove-online-reading'||!text(catalog.version,40)||!Array.isArray(items)||!items.length||items.length>32)throw Error('catalog-invalid');
  const ids=new Set();
  for(const item of items){
   if(!text(item.id,80)||!/^[a-z0-9-]+$/.test(item.id)||ids.has(item.id)||!text(item.title,120)||!Array.isArray(item.authors)||!item.authors.length||!item.authors.every(a=>text(a,120))||!Array.isArray(item.words)||!item.words.every(w=>/^\p{Script=Han}{1,8}$/u.test(w))||item.reviewStatus!=='pilot-selected-teaching-pending'||!/^[a-f0-9]{64}$/.test(item.sha256))throw Error('catalog-invalid');
   ids.add(item.id);
   if(item.kind==='story'){
    if(item.sourceId!=='global-asp'||item.license!=='CC-BY-3.0'||!/^[a-f0-9]{40}$/.test(item.revision)||!/^zh\/[0-9]{4}_[\p{Script=Han}？]+\.md$/u.test(item.path)||!/^https:\/\/global-asp\.github\.io\/storybooks-chinese\/stories\/zh\/[0-9]{4}\/$/.test(item.sourceUrl))throw Error('catalog-invalid');
   }else if(item.kind!=='sentence'||item.sourceId!=='tatoeba'||item.license!=='CC-BY-2.0-FR'||!Number.isSafeInteger(item.remoteId)||item.remoteId<1||!Number.isSafeInteger(item.translationId)||item.translationId<1||item.sourceUrl!=='https://tatoeba.org/en/sentences/show/'+item.remoteId)throw Error('catalog-invalid');
  }
  const fetcher=options.fetcher||globalThis.fetch,crypt=options.crypto||globalThis.crypto,storage=options.cacheStorage===undefined?globalThis.caches:options.cacheStorage,timeout=options.timeoutMs??10000;
  const get=id=>{const item=items.find(i=>i.id===id);if(!item)throw Error('reading-unknown');return item;};
  const key=item=>'https://mandarin-grove.invalid/public-readings/'+encodeURIComponent(catalog.version)+'/'+item.id+'/'+item.sha256;
  const digest=async bytes=>Array.from(new Uint8Array(await crypt.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  async function decode(item,raw){
   if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_BYTES)throw Error('reading-too-large');
   let paragraphs,translation=[],canonical=raw;
   if(item.kind==='story'){
    const parts=raw.trim().split(/^##\s*$/m).map(x=>x.trim());
    if(parts.length<3||!parts[0].startsWith('# ')||!parts.at(-1).includes('* License: [CC-BY]')||!parts.at(-1).includes('* Language: zh'))throw Error('reading-invalid');
    paragraphs=parts.slice(1,-1);if(!paragraphs.length||paragraphs.length>40||!paragraphs.every(p=>text(p,2000)))throw Error('reading-invalid');
   }else{
    let s;try{s=JSON.parse(raw)?.data;}catch{throw Error('reading-invalid');}
    const translations=s?.translations?.filter(t=>t.id===item.translationId),t=translations?.[0];
    if(s?.id!==item.remoteId||s.lang!=='cmn'||s.script!=='Hans'||s.is_unapproved!==false||s.license!=='CC BY 2.0 FR'||!text(s.text,2000)||!text(s.owner,120)||translations?.length!==1||t.lang!=='eng'||t.is_direct!==true||t.is_unapproved!==false||t.license!=='CC BY 2.0 FR'||!text(t.text,2000)||!text(t.owner,120))throw Error('reading-invalid');
    canonical=JSON.stringify([s.id,s.text,s.lang,s.script,s.license,s.owner,s.is_unapproved,[t.id,t.text,t.lang,t.license,t.owner,t.is_unapproved,t.is_direct]]);
    paragraphs=[s.text];translation=[t.text];
   }
   if(await digest(new TextEncoder().encode(canonical))!==item.sha256)throw Error('reading-changed');
   return {item:JSON.parse(JSON.stringify(item)),paragraphs,translation,raw,saved:false};
  }
  async function existing(){if(!storage||!await storage.has(CACHE))return null;return storage.open(CACHE);}
  async function saved(item){
   try{const cache=await existing(),response=await cache?.match(key(item));if(!response)return null;
    const raw=await bounded(response);return {...await decode(item,raw),saved:true};
   }catch{return null;}
  }
  async function bounded(response){
   if(!response.ok)throw Error('reading-unavailable');
   if(Number(response.headers.get('content-length'))>MAX_BYTES)throw Error('reading-too-large');
   const reader=response.body?.getReader();if(!reader)throw Error('reading-invalid');
   let bytes=0;const parts=[];
   try{while(true){const r=await reader.read();if(r.done)break;bytes+=r.value.byteLength;if(bytes>MAX_BYTES)throw Error('reading-too-large');parts.push(r.value);}}
   catch(e){await reader.cancel().catch(()=>{});throw e;}
   const joined=new Uint8Array(bytes);let offset=0;for(const part of parts){joined.set(part,offset);offset+=part.byteLength;}
   return new TextDecoder('utf-8',{fatal:true}).decode(joined);
  }
  async function read(id,{signal}={}){
   const item=get(id);if(signal?.aborted)throw Error('reading-cancelled');
   const controller=new AbortController();let timer,abort;
   const stopped=new Promise((_,reject)=>{
    abort=()=>{controller.abort();reject(Error('reading-cancelled'));};signal?.addEventListener('abort',abort,{once:true});
    timer=setTimeout(()=>{controller.abort();reject(Error('reading-timeout'));},timeout);
   });
   try{return await Promise.race([stopped,(async()=>{
    const cached=await saved(item);if(controller.signal.aborted)throw Error('reading-cancelled');if(cached)return cached;
    const response=await fetcher(endpoint(item),{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'no-store'});
    return decode(item,await bounded(response));
   })()]);}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  return {
   list:()=>JSON.parse(JSON.stringify(items)),read,
   isSaved:async id=>!!await saved(get(id)),
   save:async(id,result)=>{
    const item=get(id),verified=await decode(item,result?.raw);if(!storage)throw Error('reading-storage-unavailable');
    const cache=await storage.open(CACHE),keys=await cache.keys(),target=key(item);let total=new TextEncoder().encode(verified.raw).length;
    if(keys.filter(k=>k.url!==target).length>=MAX_SAVED)throw Error('reading-cache-full');
    for(const k of keys)if(k.url!==target){const r=await cache.match(k);if(r)total+=new TextEncoder().encode(await bounded(r)).length;}
    if(total>MAX_CACHE_BYTES)throw Error('reading-cache-full');
    await cache.put(target,new Response(verified.raw,{headers:{'Content-Type':'text/plain; charset=utf-8'}}));
   },
   remove:async id=>{const cache=await existing();if(cache)await cache.delete(key(get(id)));},
   licenseUrl:id=>licenses[get(id).license],
   sourceEndpoint:id=>endpoint(get(id)),
   version:catalog.version
  };
 }
 const api={createLibrary};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GroveOnlineContent=api;
})(typeof globalThis!=='undefined'?globalThis:this);
