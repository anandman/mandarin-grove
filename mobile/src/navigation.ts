const notices=new Map([
 ['audio-sources/LICENSE-MSU.txt','MSU recording license'],
 ['audio-sources/MSU-VERIFICATION.json','MSU source notes'],
 ['vendor/SOURCE-NOTICES.md','Third-party source notices'],
 ['vendor/cc-cedict/LICENSE','CC-CEDICT license'],
 ['content/online-reading-notices.txt','Reading source notices'],
 ['vendor/writing-spark/LICENSE','Writing Spark license']
]);
const textAliases=new Map([['vendor/cc-cedict/LICENSE','native/notices/cc-cedict.txt'],['vendor/writing-spark/LICENSE','native/notices/writing-spark.txt']]);
export function resolveBundledNotice(input:string,base:string){
 try{
  const origin=new URL(base),url=new URL(input,origin),title=notices.get(url.pathname.slice(1));
  // URL.origin is "null" for every capacitor:// host. Compare the actual
  // protocol, host and port so another custom-scheme host is never admitted.
  if(!title||!['http:','https:','capacitor:'].includes(origin.protocol)||url.protocol!==origin.protocol||url.hostname!==origin.hostname||url.port!==origin.port||url.username||url.password)return;
  const alias=textAliases.get(url.pathname.slice(1));if(alias)url.pathname='/'+alias;
  url.search='';url.hash='';return {url:url.href,title};
 }catch{return;}
}
interface NoticeOptions {
 createDialog:(id:string,title:string)=>HTMLDialogElement;
 stopSpeech?:()=>unknown;
 document?:Document;
 fetchNotice?:typeof fetch;
}
export function installBundledNotices({createDialog,stopSpeech=()=>{},document=window.document,fetchNotice=(...args)=>fetch(...args)}:NoticeOptions){
 type OpenNotice={dialog:HTMLDialogElement;request?:AbortController};
 let current:OpenNotice|undefined;
 const close=()=>{const old=current;if(!old)return;current=undefined;old.request?.abort();if(old.dialog.open)old.dialog.close();old.dialog.remove();};
 function open(notice:{url:string;title:string}){
  close();
  try{void Promise.resolve(stopSpeech()).catch(()=>{});}catch{/* The speech adapter retains a failed stop; reading a notice starts no audio. */}
  const dialog=createDialog('grove-native-notice',notice.title),state:OpenNotice={dialog};current=state;
  const status=document.createElement('p');status.setAttribute('role','status');status.className='reading-note';
  const text=document.createElement('pre');text.setAttribute('tabindex','0');text.setAttribute('role','document');text.setAttribute('aria-label','Notice text');text.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.5;';
  const retry=document.createElement('button');retry.type='button';retry.className='btn gray';retry.textContent='Retry';
  dialog.append(status,text,retry);
  dialog.addEventListener('close',()=>{state.request?.abort();if(current===state)current=undefined;});
  const active=(request:AbortController)=>current===state&&state.request===request&&dialog.isConnected&&dialog.open;
  async function load(){
   state.request?.abort();const request=new AbortController();state.request=request;
   status.textContent='Opening notice…';text.hidden=true;retry.hidden=true;retry.disabled=true;
   const timer=setTimeout(()=>request.abort(),15000);
   try{
    const response=await fetchNotice(notice.url,{signal:request.signal,cache:'no-store'});
    if(!response.ok)throw Error('Notice unavailable');
    const value=await response.text();
    if(request.signal.aborted||!value.trim()||new TextEncoder().encode(value).length>256*1024)throw Error('Notice unavailable');
    if(!active(request))return;
    // Even a mistaken HTML MIME type is displayed only as selectable text.
    text.textContent=value;text.hidden=false;status.textContent='';
   }catch{
    if(!active(request))return;
    status.textContent='Could not open this notice. Try again.';retry.hidden=false;
   }finally{clearTimeout(timer);if(active(request))retry.disabled=false;}
  }
  retry.onclick=()=>void load();document.body.append(dialog);dialog.showModal();dialog.querySelector<HTMLButtonElement>('[aria-label="Close"]')?.focus();void load();
 }
 const clicked=(event:MouseEvent)=>{
  if(event.defaultPrevented||event.button!==0)return;
  const anchor=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;if(!anchor)return;
  const notice=resolveBundledNotice(anchor.href,document.baseURI);if(!notice)return;
  event.preventDefault();anchor.focus({preventScroll:true});open(notice);
 };
 document.addEventListener('click',clicked);
 return ()=>{document.removeEventListener('click',clicked);close();};
}
