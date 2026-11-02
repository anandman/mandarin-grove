// A system-picker result belongs to this startup only. No storage, import or
// UI navigation occurs here; the grown-up explicitly consumes a pending result.
export type RestoredFileResult =
 {method:'open';cancelled:true;error?:never}|
 {method:'open';cancelled:false;text:string;error?:never}|
 {method:'save'|'feedbackSave';saved:boolean;error?:never}|
 {method:'feedbackShare';closed:true;error?:never}|
 {method:'open'|'save'|'feedbackSave'|'feedbackShare';error:string;saved?:true};
export function createRestoredFileMailbox({notify=()=>{},limit=64*1024*1024}:{notify?:()=>void;limit?:number}={}){
 let result:RestoredFileResult|undefined,seen=false,invalidated=false;
 const failure='The file result could not be recovered. Choose the file again. Your progress and saved files were kept.';
 function accept(event:unknown):boolean{
  if(invalidated||seen||!event||typeof event!=='object')return false;
  const value=event as Record<string,any>;
  const methods=new Map([['openText','open'],['saveText','save'],['saveFeedback','feedbackSave'],['shareFeedback','feedbackShare']] as const);
  if(value.pluginId!=='GroveFiles'||!methods.has(value.methodName))return false;
  const method=methods.get(value.methodName)!;
  if(value.success===false){
   const message=value.error?.message;
   result={method,error:typeof message==='string'&&message.length>0&&message.length<=512?message:failure,...(['save','feedbackSave'].includes(method)&&value.error?.code==='GROVE_EXPORT_SAVED'?{saved:true as const}:{})};
  }else if(value.success===true&&(method==='save'||method==='feedbackSave')&&typeof value.data?.saved==='boolean')result={method,saved:value.data.saved};
  else if(value.success===true&&method==='feedbackShare'&&value.data?.closed===true)result={method,closed:true};
  else if(value.success===true&&method==='open'&&value.data?.cancelled===true)result={method,cancelled:true};
  else if(value.success===true&&method==='open'&&value.data?.cancelled===false&&typeof value.data.text==='string'&&new TextEncoder().encode(value.data.text).byteLength<=limit)result={method,cancelled:false,text:value.data.text};
  else result={method,error:failure};
  seen=true;notify();return true;
 }
 return Object.freeze({accept,get hasPending(){return !!result;},take(){const current=result;result=undefined;return current;},invalidate(){invalidated=true;result=undefined;notify();}});
}
