/* Storage-shaped compatibility adapter; portable doubles use the same commit path. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../core/state.js'),require('../core/backup.js'));else root.GroveStorage=factory(root.GroveState,root.GroveBackup);})(globalThis,(state,backup)=>{
 'use strict';
 const REGISTRY='zh_profiles',JOURNAL='zh_import_recovery_v1',EXTRAS='zh_backup_meta_v1',REPORTS='zh_feedback_v1';
 const PREFERENCES=new Set(['zh_appearance','zh_voice','zh_bk']);
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
    if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||!(pair[0]===REGISTRY||pair[0]===EXTRAS||pair[0].startsWith('zh_p_')||record.operation==='erase'&&managedKey(pair[0])&&pair[0]!==JOURNAL)||keys.has(pair[0])||pair[1]!==null&&typeof pair[1]!=='string')throw new Error('Invalid progress recovery record; existing data was kept.');
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
  function commit(changes,{operation}={}){
   recoverImport();const before=changes.map(([key])=>[key,read(key)]),id=String(now())+':'+makeId();
   const record={version:1,id,owner,phase:'writing',leaseUntil:now()+10000,before,after:changes,...(operation?{operation}:{})};journalRows(record);
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
  function profileSnapshot(id){
   const registry=registrySnapshot();if(!registry.list.some(p=>p.id===id))throw new Error('Child profile is not listed');
   const raw=read('zh_p_'+id);if(raw===null)throw new Error('This child’s saved progress is missing. Existing data was kept.');
   const original=JSON.parse(raw);state.validateProfile(original);
   return {original,profile:state.prepareProfile(original,{now:now(),migrate:(value,time)=>migrate(value,time,registry.list.find(p=>p.id===id))})};
  }
  function readProfile(id){
   const snapshot=profileSnapshot(id);bases.set(id,state.copy(snapshot.original));return snapshot.profile;
  }
  function saveProfile(id,value,expectedRevision){
   if(state.isObject(expectedRevision))expectedRevision=expectedRevision.expectedRevision;
   recoverImport();state.validateProfile(value);const key='zh_p_'+id,raw=read(key);
   if(raw===null)throw new Error('This child’s saved progress is missing.');
   const remote=state.validateProfile(JSON.parse(raw));
   if(expectedRevision!==undefined&&raw!==expectedRevision)throw new Error('Progress changed in another tab. Reload before saving again.');
   const merged=bases.has(id)?merge(bases.get(id),value,remote):state.copy(value);state.validateProfile(merged);
   storage.setItem(key,JSON.stringify(merged));bases.set(id,state.copy(merged));return state.copy(merged);
  }
  // Commit learner metadata and its matching configuration under one journal.
  function saveChildSettings(id,registry,value){
   recoverImport();validateRegistry(registry);state.validateProfile(value);
   const key='zh_p_'+id,registryRaw=read(REGISTRY),profileRaw=read(key);
   if(!profileRaw)throw new Error('This child’s saved progress is missing.');
   const remoteRegistry=validateRegistry(JSON.parse(registryRaw)),remote=state.validateProfile(JSON.parse(profileRaw));
   const nextRegistry=registryBase?merge(registryBase,registry,remoteRegistry,'profiles'):state.copy(registry);
   if(!remoteRegistry.list.some(p=>p.id===id)||!nextRegistry.list.some(p=>p.id===id))throw new Error('This child is no longer available. Reload before saving.');
   const nextProfile=bases.has(id)?merge(bases.get(id),value,remote):state.copy(value);
   validateRegistry(nextRegistry);state.validateProfile(nextProfile);
   if(read(REGISTRY)!==registryRaw||read(key)!==profileRaw)throw new Error('Progress changed while saving settings. Reload before saving.');
   commit([[key,JSON.stringify(nextProfile)],[REGISTRY,JSON.stringify(nextRegistry)]]);
   registryBase=state.copy(nextRegistry);bases.set(id,state.copy(nextProfile));
   return {registry:state.copy(nextRegistry),profile:state.copy(nextProfile)};
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
  function importBackup(code,{expectedStamp}={}){
   const candidate=previewBackup(code);recoverImport();
   if(expectedStamp!==undefined&&expectedStamp!==deviceStamp())throw new Error('Device progress changed after this preview. Refresh the comparison before replacing it.');
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
  // Device settings/reports deliberately remain outside learner backup data.
  function preferenceKey(key){if(!PREFERENCES.has(key))throw new Error('Unsupported device preference');return key;}
  function readPreference(key){return read(preferenceKey(key));}
  function writePreference(key,value){
   preferenceKey(key);if(value!==null&&typeof value!=='string')throw new Error('Device preference must be text or null');
   write(key,value);return value;
  }
  function validateReports(rows){
   if(!Array.isArray(rows)||rows.length>50||rows.some(row=>!state.isObject(row)))throw new Error('Saved reports need attention. Existing reports have been kept.');
   return rows;
  }
  function readReports(){const raw=read(REPORTS);return raw===null?[]:validateReports(JSON.parse(raw));}
  function saveReports(rows){validateReports(rows);storage.setItem(REPORTS,JSON.stringify(rows));return state.copy(rows);}
  function saveReport(report){
   if(!state.isObject(report)||typeof report.id!=='string'||!report.id)throw new Error('Report ID is required');
   const rows=readReports(),index=rows.findIndex(row=>row.id===report.id);
   if(index>=0)rows[index]=state.copy(report);
   else{
    if(rows.length>=50){const discard=rows.findIndex(row=>!['pending','failed'].includes(row.delivery?.state));if(discard<0)throw new Error('Report storage is full');rows.splice(discard,1);}
    rows.push(state.copy(report));
   }
   saveReports(rows);return state.copy(report);
  }
  function managedKey(key){return typeof key==='string'&&(key.startsWith('zh_')||key==='owenzh_v1');}
  function managedKeys(){const keys=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(managedKey(key))keys.push(key);}return keys.sort();}
  function deviceStamp(){return JSON.stringify(managedKeys().filter(key=>key===REGISTRY||key.startsWith('zh_p_')||key===EXTRAS||key==='owenzh_v1').map(key=>[key,read(key)]));}
  function backupSummary(){
   const before=deviceStamp(),registry=state.copy(registrySnapshot()),stamp=deviceStamp();
   if(before!==stamp)throw new Error('Device progress changed while preparing the comparison. Please try again.');
   return {registry,stamp};
  }
  // Recovery must work even when a corrupt journal prevents ordinary reads.
  function exportRecovery(){return {format:'mandarin-grove-recovery-v1',storage:Object.fromEntries(managedKeys().map(key=>[key,read(key)]))};}
  function eraseLocal(){
   recoverImport();commit(managedKeys().map(key=>[key,null]),{operation:'erase'});bases.clear();registryBase=undefined;return true;
  }
  return {peekRegistry:()=>state.copy(registrySnapshot()),peekProfile:id=>state.copy(profileSnapshot(id).profile),readRegistry,readProfile,saveProfile,saveRegistry,saveChildSettings,previewBackup,importBackup,exportBackup,recoverImport,createProfile,deleteProfile,readPreference,writePreference,readReports,saveReports,saveReport,deviceStamp,backupSummary,exportRecovery,eraseLocal};
 }
 return {createRepository};
});
