/* Native write-through repository: snapshot -> validate/merge -> SQLite CAS -> ACK. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../core/state.js'),require('./web-storage.js'));else root.GroveNativeStorage=factory(root.GroveState,root.GroveStorage);})(globalThis,(state,web)=>{
 'use strict';
 const methods=['peekRegistry','readRegistry','peekProfile','readProfile','saveRegistry','saveProfile','saveChildSettings','previewBackup','importBackup','exportBackup','recoverImport','createProfile','deleteProfile','readPreference','writePreference','readReports','saveReports','saveReport','deviceStamp','backupSummary','eraseLocal'];
 const copy=value=>value===undefined?undefined:state.copy(value);
 const readOnly=new Set(['peekRegistry','readRegistry','peekProfile','readProfile','previewBackup','exportBackup','recoverImport','readPreference','readReports','deviceStamp','backupSummary']);
 function memory(entries){
  const values=new Map(Object.entries(entries));
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),key:index=>[...values.keys()][index]??null,get length(){return values.size;},values};
 }
 async function hash(text){const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(data)].map(n=>n.toString(16).padStart(2,'0')).join('');}
 function createRepository({database,codec,migrate,now=Date.now,makeId}){
  let tail=Promise.resolve(),registryBase;const profileBases=new Map();
  function serial(action){const result=tail.then(action);tail=result.then(()=>undefined,()=>undefined);return result;}
  async function invoke(method,args){
   const before=await database.readSnapshot(),store=memory(before.entries);
   const repository=web.createRepository({storage:store,codec,migrate,now,makeId});
   // Seed the pure merge engine with this caller's acknowledged read baselines,
   // then restore the latest SQL snapshot without refreshing those baselines.
   if(['saveRegistry','saveChildSettings'].includes(method)&&registryBase!==undefined){
    registryBase===null?store.removeItem('zh_profiles'):store.setItem('zh_profiles',registryBase);repository.readRegistry();
    before.entries.zh_profiles===undefined?store.removeItem('zh_profiles'):store.setItem('zh_profiles',before.entries.zh_profiles);
   }
   if(['saveProfile','saveChildSettings'].includes(method)){
    const id=args[0],baseline=profileBases.get(id);
    if(baseline===undefined)throw Error('Reload this child before saving native progress.');
    if(before.entries['zh_p_'+id]===undefined)throw Error('This child’s saved progress is missing. Existing data has been kept.');
    const key='zh_p_'+id;store.setItem(key,baseline);repository.readProfile(id);store.setItem(key,before.entries[key]);
   }
   if(method==='saveProfile'&&args[2]?.expectedRevision!==undefined){
    if(args[2].expectedRevision!==before.revision)throw Error('Native progress revision changed. Reload before saving.');
    args[2]={...args[2],expectedRevision:undefined};
   }
   const result=repository[method](...args),keys=new Set([...Object.keys(before.entries),...store.values.keys()]);
   const changes=[...keys].sort().filter(key=>(before.entries[key]??null)!==store.getItem(key)).map(key=>[key,store.getItem(key)]);
   let snapshot=before;
   if(changes.length||method==='importBackup'||method==='eraseLocal'){
    const reason=method==='importBackup'?'import':method==='deleteProfile'?'delete':method==='eraseLocal'?'erase':readOnly.has(method)?'bootstrap':method==='saveProfile'&&args[2]?.reason||'save';
    const metadata={reason};
    if(method==='importBackup'){metadata.originalCode=args[0];metadata.payloadHash=await hash(codec.decodeUtf8(args[0].replace(/\s/g,'')));}
    snapshot=await database.commit(before.revision,changes,metadata);
   }
   // A refused SQL commit must never move these baselines or publish a result.
   if(['readRegistry','saveRegistry','saveChildSettings','importBackup','createProfile','deleteProfile'].includes(method))registryBase=snapshot.entries.zh_profiles??null;
   if(method==='readProfile'||method==='saveProfile'||method==='saveChildSettings')profileBases.set(args[0],snapshot.entries['zh_p_'+args[0]]);
   if(method==='importBackup'||method==='eraseLocal')profileBases.clear();
   if(method==='eraseLocal')registryBase=undefined;
   if(method==='deleteProfile')profileBases.delete(args[0]);
   return copy(result);
  }
  const repository={};for(const method of methods)repository[method]=(...args)=>{let captured;try{captured=args.map(copy);}catch(error){return Promise.reject(error);}return serial(()=>invoke(method,captured));};
  repository.exportRecovery=()=>serial(()=>database.exportRecovery());
  return Object.freeze(repository);
 }
 return {createRepository};
});
