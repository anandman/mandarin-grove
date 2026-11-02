export interface TextSizePlugin {
 addListener(name:'textSizeChanged',listener:(value:{scale:unknown})=>void):Promise<{remove():Promise<void>}>;
 preferredScale():Promise<{scale:unknown}>;
}
type TextDocument={documentElement:{style:{setProperty(name:string,value:string):void}}};
// Text-only adjustment keeps the existing document, viewport and drawing geometry.
export async function installNativeTextSize(plugin:TextSizePlugin,target:TextDocument=document){
 let active=true,generation=0;
 function apply(value:{scale:unknown}){
  const scale=value?.scale;if(typeof scale!=='number'||!Number.isFinite(scale)||scale<=0||scale>10)return false;
  target.documentElement.style.setProperty('--grove-text-scale',String(Math.max(1,scale)));return true;
 }
 const listener=await plugin.addListener('textSizeChanged',value=>{if(active&&apply(value))generation++;});
 try{const value=await plugin.preferredScale();if(active&&generation===0&&!apply(value))throw Error('Native text preference unavailable');}
 catch(error){active=false;await listener.remove();throw error;}
 return Object.freeze({async dispose(){if(!active)return;active=false;await listener.remove();}});
}
