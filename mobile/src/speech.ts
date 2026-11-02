export interface NativeVoice {voiceURI:string;name:string;lang:string;localService:boolean;default:boolean}
export type SpeechResult={spoken:true}|{spoken:false;reason:'cancelled'|'unavailable'|'background'|'error'|'invalid'};
export interface SpeechPlugin {
 getVoices():Promise<{voices:NativeVoice[]}>;
 speak(request:{id:string;text:string;lang:string;voiceURI:string;rate:number}):Promise<{id:string;spoken:boolean;reason?:string}>;
 stop(request:{id?:string}):Promise<void>;
}
interface SpeechRequest {text:string;lang:'zh-CN'|'en-US';voiceURI?:string;rate?:number}
export function createNativeSpeech(plugin:SpeechPlugin,{makeId=()=>crypto.randomUUID(),notify=()=>{}}:{makeId?:()=>string;notify?:()=>void}={}){
 type Pending={id:string;finish:(result:SpeechResult)=>void};
 let voices:readonly NativeVoice[]=Object.freeze([]),refreshing:Promise<boolean>|undefined,active=true,pending:Pending|undefined,nativeId:string|undefined,tail:Promise<void>=Promise.resolve();
 function queue(action:()=>void|Promise<void>){const result=tail.then(action);tail=result.catch(()=>{});return result;}
 function finish(request:Pending,result:SpeechResult){if(pending===request)pending=undefined;request.finish(result);}
 function cancel():Promise<void>{
  const old=pending;pending=undefined;old?.finish({spoken:false,reason:'cancelled'});
  return queue(async()=>{const id=nativeId;if(!id)return;await plugin.stop({id});if(nativeId===id)nativeId=undefined;});
 }
 function refresh():Promise<boolean>{
  if(!refreshing)refreshing=(async()=>{
   try{
    const result=await plugin.getVoices();
    voices=Object.freeze(result.voices.filter(v=>v.localService===true&&typeof v.voiceURI==='string'&&v.voiceURI.length<=512&&typeof v.name==='string'&&v.name.length<=256&&typeof v.lang==='string').slice(0,512).map(v=>Object.freeze({...v})));
    notify();return true;
   }catch{voices=Object.freeze([]);notify();return false;}
   finally{refreshing=undefined;}
  })();
  return refreshing;
 }
 function matches(voice:NativeVoice,lang:string){
  const tag=voice.lang.replace(/_/g,'-').toLowerCase();
  return lang==='en-US'?/^en(?:-|$)/.test(tag):!/(?:^|-)(?:hk|mo|yue)(?:-|$)/.test(tag)&&(/^(?:cmn)(?:-|$)/.test(tag)||/^zh(?:$|-(?:cn|tw|sg|hans|hant)(?:-|$))/.test(tag));
 }
 function speak(input:SpeechRequest):Promise<SpeechResult>{
  const request={...input};
  if(typeof request.text!=='string'||!request.text.trim()||request.text.length>2000||!['zh-CN','en-US'].includes(request.lang)||request.rate!==undefined&&(!Number.isFinite(request.rate)||request.rate<0.5||request.rate>1.5))return Promise.resolve({spoken:false,reason:'invalid'});
  if(!active)return Promise.resolve({spoken:false,reason:'background'});
  const stopped=cancel();let resolve!:(result:SpeechResult)=>void;const result=new Promise<SpeechResult>(r=>resolve=r),current:Pending={id:makeId(),finish:resolve};pending=current;
  void (async()=>{
   try{
    await stopped;await refresh();if(pending!==current||!active)return;
    const candidates=voices.filter(v=>matches(v,request.lang));
    const voice=request.voiceURI?candidates.find(v=>v.voiceURI===request.voiceURI):candidates.find(v=>v.lang.replace(/_/g,'-').toLowerCase()===request.lang.toLowerCase())||candidates.find(v=>v.lang.replace(/_/g,'-').toLowerCase().split('-').includes(request.lang.toLowerCase().split('-').at(-1)!))||candidates.find(v=>v.default)||candidates[0];
    if(!voice){finish(current,{spoken:false,reason:'unavailable'});return;}
    await queue(()=>{
     if(pending!==current||!active)return;
     nativeId=current.id;
     void plugin.speak({id:current.id,text:request.text,lang:request.lang,voiceURI:voice.voiceURI,rate:request.rate??0.75}).then(response=>{
      if(nativeId===current.id)nativeId=undefined;
      if(pending!==current)return;
      if(response.id!==current.id){finish(current,{spoken:false,reason:'error'});return;}
      finish(current,response.spoken?{spoken:true}:{spoken:false,reason:['cancelled','unavailable','background'].includes(response.reason??'')?response.reason as 'cancelled'|'unavailable'|'background':'error'});
     },()=>{if(nativeId===current.id)nativeId=undefined;if(pending===current)finish(current,{spoken:false,reason:'error'});});
    });
   }catch{if(pending===current)finish(current,{spoken:false,reason:'error'});}
  })();
  return result;
 }
 return Object.freeze({speak,cancel,refresh,get voices(){return voices;},get active(){return active;},get speaking(){return !!pending;},setActive(value:boolean){active=value;if(!active)void cancel().catch(()=>{});}});
}
export type NativeSpeech=ReturnType<typeof createNativeSpeech>;
