// Supported Android App API. This controller never owns learner state: the UI
// decides whether Back was handled, and only an unhandled root Back minimizes.
interface BackApp {
 addListener(name:'backButton',listener:()=>void):Promise<{remove():Promise<void>}>;
 toggleBackButtonHandler(options:{enabled:boolean}):Promise<void>;
 minimizeApp():Promise<void>;
}
export function createAndroidBackController(app:BackApp,reportError:(error:unknown)=>void=()=>{}){
 let handler:(()=>boolean|Promise<boolean>)|undefined,busy=false,enabled=false,registration:Promise<boolean>|undefined;
 async function handleBack(){
  if(!enabled||busy||!handler)return;
  busy=true;const current=handler;
  try{if(!await current())await app.minimizeApp();}
  catch(error){reportError(error);}
  finally{busy=false;}
 }
 function install(next:()=>boolean|Promise<boolean>):Promise<boolean>{
  handler=next;
  if(!registration)registration=(async()=>{
   const listener=await app.addListener('backButton',handleBack);
   try{await app.toggleBackButtonHandler({enabled:true});enabled=true;return true;}
   catch(error){await listener.remove();throw error;}
  })().catch(error=>{enabled=false;registration=undefined;throw error;});
  return registration;
 }
 return Object.freeze({install});
}
