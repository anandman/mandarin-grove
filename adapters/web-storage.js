/* Storage-shaped compatibility adapter; portable doubles use the same commit path. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../core/state.js'),require('../core/backup.js'));else root.GroveStorage=factory(root.GroveState,root.GroveBackup);})(globalThis,(state,backup)=>{
 'use strict';
 const REGISTRY='zh_profiles',JOURNAL='zh_import_recovery_v1',EXTRAS='zh_backup_meta_v1';
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const missing=Symbol('missing');
 let repositorySequence=0;
 // Arrays/counters are indivisible. Only disjoint object edits can merge safely.
 function merge(base,local,remote,path='progress'){
  if(same(local,base))return remote;if(same(remote,base)||same(local,remote))return local;
  if(state.isObject(base)&&state.isObject(local)&&state.isObject(remote)){
   const result={};for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
    const value=merge(state.own(base,key)?base[key]:missing,state.own(local,key)?local[key]:missing,state.own(remote,key)?remote[key]:missing,path+'.'+key);
    if(value!==missing)Object.defineProperty(result,key,{value,enumerable:true,writable:true,configurable:true});
   }return result;
  }
  throw new Error('Progress changed in another tab ('+path+'). Reload before saving again.');
 }
 function createRepository({storage,codec,now=Date.now,makeId=()=>Math.random().toString(36).slice(2),migrate=s=>s}){
  const bases=new Map(),owner=String(now())+':'+makeId()+':'+(++repositorySequence);let registryBase;
  const read=key=>storage.getItem(key);
  const write=(key,value)=>value===null?storage.removeItem(key):storage.setItem(key,value);
  function journalRows(record){
   if(!state.isObject(record)||record.version!==1||typeof record.id!=='string'||!Array.isArray(record.before))throw new Error('Progress recovery record needs attention; existing data was kept.');
   const keys=new Set();for(const pair of record.before){
    if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||!(pair[0]===REGISTRY||pair[0]===EXTRAS||pair[0].startsWith('zh_p_'))||keys.has(pair[0])||pair[1]!==null&&typeof pair[1]!=='string')throw new Error('Invalid progress recovery record; existing data was kept.');
    keys.add(pair[0]);
   }
   if(record.after!==undefined){
    if(!Array.isArray(record.after)||record.after.length!==record.before.length||record.after.some((pair,i)=>!Array.isArray(pair)||pair.length!==2||pair[0]!==record.before[i][0]||pair[1]!==null&&typeof pair[1]!=='string'))throw new Error('Invalid proposed recovery values');
   }
   return record.before;
  }
  function restore(record){
   if(record.after)for(let i=0;i<record.before.length;i++){
    const current=read(record.before[i][0]);if(current!==record.before[i][1]&&current!==record.after[i][1])throw new Error('Another tab changed progress during recovery. Original and proposed values were retained.');
   }
   for(const [key,value]of record.before)write(key,value);
  }
  function recoverImport(){
   const raw=read(JOURNAL);if(raw===null)return false;
   let record;try{record=JSON.parse(raw);journalRows(record);}catch(error){throw new Error('Progress recovery needs attention. '+error.message);}
   if(record.phase==='writing'&&record.owner!==owner&&Number.isFinite(record.leaseUntil)&&now()<record.leaseUntil)throw new Error('Another tab is saving progress. Wait a moment, then reload.');
   try{restore(record);storage.removeItem(JOURNAL);bases.clear();registryBase=undefined;return true;}
   catch{throw new Error('Progress recovery could not finish. Original values are retained on this device; free storage and reload.');}
  }
  function commit(changes){
   recoverImport();const before=changes.map(([key])=>[key,read(key)]),id=String(now())+':'+makeId();
   const record={version:1,id,owner,phase:'writing',leaseUntil:now()+10000,before,after:changes};journalRows(record);
   // No child writes happen unless the complete rollback snapshot was saved.
   storage.setItem(JOURNAL,JSON.stringify(record));
   try{
    for(let i=0;i<changes.length;i++){
     if(read(JOURNAL)!==JSON.stringify(record)||read(changes[i][0])!==before[i][1])throw new Error('Progress changed during this operation.');
     write(...changes[i]);
    }
    storage.removeItem(JOURNAL);
   }catch(error){
    try{restore(record);storage.removeItem(JOURNAL);}
    catch{
     try{record.phase='recovery';record.leaseUntil=0;storage.setItem(JOURNAL,JSON.stringify(record));}catch{}
     throw new Error('Progress recovery is needed. Original values are retained on this device; free storage and reload.');
    }
    throw error;
   }
  }
  function validateRegistry(registry){
   const data=Object.fromEntries((registry?.list||[]).map(p=>[p.id,'{}']));backup.validateEnvelope({PR:registry,data});return registry;
  }
  function registrySnapshot(){
   recoverImport();const raw=read(REGISTRY);
   if(raw!==null&&raw!=='null'){return validateRegistry(JSON.parse(raw));}
   const legacy=read('owenzh_v1');
   if(legacy!==null){
    let id='p1',suffix=1;while(read('zh_p_'+id)!==null)id='p1-'+suffix++;
    const profile=state.prepareProfile(legacy),registry={cur:id,list:[{id,name:'Learner',av:'🐼'}]};
    commit([['zh_p_'+id,JSON.stringify(profile)],[REGISTRY,JSON.stringify(registry)]]);return registry;
   }
   return {cur:null,list:[]};
  }
  function readRegistry(){const registry=registrySnapshot();registryBase=state.copy(registry);return registry;}
  function readProfile(id){
   const registry=registrySnapshot();if(!registry.list.some(p=>p.id===id))throw new Error('Child profile is not listed');
   const raw=read('zh_p_'+id);if(raw===null)throw new Error('This child’s saved progress is missing. Existing data was kept.');
   const original=JSON.parse(raw);state.validateProfile(original);bases.set(id,state.copy(original));
   return state.prepareProfile(original,{now:now(),migrate:(value,time)=>migrate(value,time,registry.list.find(p=>p.id===id))});
  }
  function saveProfile(id,value,expectedRevision){
   recoverImport();state.validateProfile(value);const key='zh_p_'+id,raw=read(key);
   if(raw===null)throw new Error('This child’s saved progress is missing.');
   const remote=state.validateProfile(JSON.parse(raw));
   if(expectedRevision!==undefined&&raw!==expectedRevision)throw new Error('Progress changed in another tab. Reload before saving again.');
   const merged=bases.has(id)?merge(bases.get(id),value,remote):state.copy(value);state.validateProfile(merged);
   storage.setItem(key,JSON.stringify(merged));bases.set(id,state.copy(merged));return state.copy(merged);
  }
  function saveRegistry(value){
   recoverImport();validateRegistry(value);const raw=read(REGISTRY),remote=raw&&raw!=='null'?validateRegistry(JSON.parse(raw)):{cur:null,list:[]};
   const registry=registryBase?merge(registryBase,value,remote,'profiles'):state.copy(value);validateRegistry(registry);
   const changes=[];for(const profile of registry.list)if(read('zh_p_'+profile.id)===null){
    if(remote.list.some(p=>p.id===profile.id))throw new Error('This child’s saved progress is missing. Existing data was kept for recovery.');
    changes.push(['zh_p_'+profile.id,JSON.stringify(state.emptyProfile())]);
   }
   changes.push([REGISTRY,JSON.stringify(registry)]);commit(changes);registryBase=state.copy(registry);return state.copy(registry);
  }
  function previewBackup(code){
   const candidate=backup.decodeBackup(code,codec);
   for(const profile of candidate.registry.list)state.prepareProfile(candidate.rawProfiles[profile.id],{now:now(),migrate:(value,time)=>migrate(value,time,profile)});
   return candidate;
  }
  function importBackup(code){
   const candidate=previewBackup(code);recoverImport();
   const changes=Object.entries(candidate.rawProfiles).map(([id,raw])=>['zh_p_'+id,raw]);
   changes.push([EXTRAS,JSON.stringify(candidate.envelopeExtras)],[REGISTRY,JSON.stringify(candidate.registry)]);commit(changes);
   bases.clear();registryBase=state.copy(candidate.registry);return state.copy(candidate.registry);
  }
  function exportBackup(){
   const registry=registrySnapshot(),rawProfiles=Object.fromEntries(registry.list.map(({id})=>[id,read('zh_p_'+id)])),extras=read(EXTRAS);
   return backup.encodeBackup({registry,rawProfiles,envelopeExtras:extras?JSON.parse(extras):{}},codec);
  }
  function createProfile(metadata){
   const registry=readRegistry(),prefix='p'+makeId();let id=prefix,n=1;while(registry.list.some(p=>p.id===id)||read('zh_p_'+id)!==null)id=prefix+'-'+n++;
   const profile={...state.copy(metadata),id};registry.list.push(profile);registry.cur=id;saveRegistry(registry);return profile;
  }
  function deleteProfile(id){
   const registry=readRegistry();if(!registry.list.some(p=>p.id===id))return false;
   if(registry.list.length<=1)throw new Error('Keep at least one child. The last child cannot be deleted.');
   registry.list=registry.list.filter(p=>p.id!==id);if(registry.cur===id)registry.cur=registry.list[0].id;
   commit([['zh_p_'+id,null],[REGISTRY,JSON.stringify(registry)]]);bases.delete(id);registryBase=state.copy(registry);return state.copy(registry);
  }
  return {readRegistry,readProfile,saveProfile,saveRegistry,previewBackup,importBackup,exportBackup,recoverImport,createProfile,deleteProfile};
 }
 return {createRepository};
});
