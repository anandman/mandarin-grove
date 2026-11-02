/* One Promise boundary for browser and native durability. No storage fallback. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GrovePersistence=factory();})(globalThis,()=>{
 'use strict';
 const methods=['peekRegistry','readRegistry','peekProfile','readProfile','saveRegistry','saveProfile','saveChildSettings','previewBackup','importBackup','exportBackup','recoverImport','createProfile','deleteProfile','readPreference','writePreference','readReports','saveReports','saveReport','deviceStamp','backupSummary','exportRecovery','eraseLocal'];
 const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
 function createRepository({repository,ready=()=>Promise.resolve()}){
  let initialization,tail=Promise.resolve();
  function initialize(){
   if(!initialization)initialization=Promise.resolve().then(()=>ready()).then(()=>typeof repository==='function'?repository():repository).then(selected=>{
    if(!selected||typeof selected!=='object')throw Error('Persistence is unavailable. Existing progress has been kept.');
    return selected;
   });
   return initialization;
  }
  function enqueue(operation){
   const result=tail.then(initialize).then(operation);
   // A refused operation must not prevent a later explicit retry. A failed
   // initialization remains failed; never substitute an empty browser store.
   tail=result.then(()=>undefined,()=>undefined);return result;
  }
  const facade={ready:()=>enqueue(()=>undefined)};
  for(const method of methods)facade[method]=(...args)=>{
   // Capture before readiness/queue awaits. Later UI edits cannot change the
   // selected learner, expected revision, settings or import being committed.
   let captured;try{captured=args.map(copy);}catch(error){return Promise.reject(error);}
   return enqueue(async selected=>{
    if(typeof selected[method]!=='function')throw Error('Persistence does not implement '+method+'. Existing data has been kept.');
    return copy(await selected[method](...captured));
   });
  };
  return Object.freeze(facade);
 }
 return {createRepository};
});
