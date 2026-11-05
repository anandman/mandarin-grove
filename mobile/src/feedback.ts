const ENDPOINT='https://mandarin-grove.vercel.app/api/native-feedback',APP='design.highgain.mandaringrove';
const origins=new Map([['ios','capacitor://localhost'],['android','https://localhost']]);
const categories=new Set(['sound','meaning','broken','missing']);
const contentLimits={packId:100,itemId:160,version:100,sourceId:120,reviewStatus:100};
const audioSources=new Map([['MSU Putonghua recording','msu'],['CNS11643 reference recording','cns'],['Google recording · unchecked','bundled'],['Google Cloud TTS bundled recording (device fallback if unavailable)','bundled'],['native device speech','device'],['browser speech','device']]);
export interface FeedbackReceipt {sent:true;id:string;receipt:number}
export interface FeedbackHttp {request(options:{url:string;method:string;headers:Record<string,string>;data:Record<string,unknown>;responseType:'json';disableRedirects:boolean;connectTimeout:number;readTimeout:number}):Promise<{status:number;data:unknown;url?:string}>}
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function validText(value:unknown,max:number,required=false):value is string{return typeof value==='string'&&value.length<=max&&(!required||!!value.trim())&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);}
function freeze<T>(value:T):T{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export function createNativeFeedback(http:FeedbackHttp,{platform,isPublicRecording=()=>false,deadlineMs=30000}:{platform:string;isPublicRecording?:(path:string)=>boolean;deadlineMs?:number}){
 let epoch=0;
 type Entry={key:string;promise:Promise<FeedbackReceipt>;cancel:()=>void};const pending=new Map<string,Entry>();
 function prepare(value:unknown):Record<string,unknown>{
  if(!origins.has(platform)||!object(value)||typeof value.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.id)||typeof value.category!=='string'||!categories.has(value.category)||!validText(value.note,2000)||!validText(value.version,100,true)||!validText(value.time,40,true)||!Number.isFinite(Date.parse(value.time)))throw Error('invalid-report');
  const payload:Record<string,unknown>={id:value.id,category:value.category,note:value.note,version:value.version,time:value.time,app:APP,platform};
  const q=value.question;if(object(q)&&validText(q.character,32,true)&&validText(q.pinyin,200)&&validText(q.meaning,400)&&validText(q.mode,40,true))payload.question={character:q.character,pinyin:q.pinyin,meaning:q.meaning,mode:q.mode};
  const c=value.content;if(object(c)&&Object.entries(contentLimits).every(([key,max])=>validText(c[key],max,true)&&!/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(c[key] as string)))payload.content=Object.fromEntries(Object.keys(contentLimits).map(key=>[key,c[key]]));
  const audio=object(value.audio)?value.audio:object(value.speech)?value.speech:undefined;
  if(audio){
   const source=object(value.audio)&&typeof audio.source==='string'&&['msu','cns','bundled','device','unknown'].includes(audio.source)?audio.source:typeof audio.source==='string'?audioSources.get(audio.source)||'unknown':'unknown';
   const result:Record<string,string>={source},recording=audio.recording;
   if(typeof recording==='string'&&recording.length<=200&&/^audio\/(?:msu-|cns-)[a-z0-9_-]+\.(?:mp3|wav)$/i.test(recording)&&isPublicRecording(recording))result.recording=recording;
   payload.audio=result;
  }
  if(new TextEncoder().encode(JSON.stringify(payload)).length>16384)throw Error('invalid-report');
  return freeze(payload);
 }
 function send(value:unknown,expectedEpoch=epoch):Promise<FeedbackReceipt>{
  let payload:Record<string,unknown>;try{payload=prepare(value);}catch{return Promise.reject(Error('invalid-report'));}
  if(expectedEpoch!==epoch)return Promise.reject(Error('cancelled'));
  const id=payload.id as string,key=JSON.stringify(payload),existing=pending.get(id);
  if(existing)return existing.key===key?existing.promise:Promise.reject(Error('report-changed'));
  let resolve!:(value:FeedbackReceipt)=>void,reject!:(error:Error)=>void,done=false,timer:ReturnType<typeof setTimeout>;
  const promise=new Promise<FeedbackReceipt>((r,j)=>{resolve=r;reject=j;});
  const entry:Entry={key,promise,cancel:()=>finish(Error('cancelled'))};
  function finish(error?:Error,receipt?:FeedbackReceipt){if(done)return;done=true;clearTimeout(timer);if(pending.get(id)===entry)pending.delete(id);if(error)reject(error);else resolve(receipt!);}
  pending.set(id,entry);timer=setTimeout(()=>finish(Error('not-confirmed')),Math.min(30000,Math.max(1,deadlineMs)));
  void(async()=>{
   try{
    if(done||expectedEpoch!==epoch)return;
    const response=await http.request({url:ENDPOINT,method:'POST',headers:{'Content-Type':'application/json',Origin:origins.get(platform)!},data:payload,responseType:'json',disableRedirects:true,connectTimeout:10000,readTimeout:10000});
    if(done)return;if(expectedEpoch!==epoch){finish(Error('cancelled'));return;}
    let data=response.data;if(typeof data==='string'){if(data.length>4096)throw Error();data=JSON.parse(data);}
    if(object(data)&&data.error==='feedback-not-configured'){finish(Error('not-configured'));return;}
    if(![200,201].includes(response.status)||(response.url&&response.url!==ENDPOINT)||!object(data)||data.sent!==true||data.id!==id||!Number.isSafeInteger(data.receipt)||(data.receipt as number)<1)throw Error();
    finish(undefined,{sent:true,id,receipt:data.receipt as number});
   }catch{finish(Error('not-confirmed'));}
  })();
  return promise;
 }
 function invalidate(){epoch++;for(const entry of [...pending.values()])entry.cancel();pending.clear();}
 return Object.freeze({prepare,send,invalidate,get epoch(){return epoch;}});
}
