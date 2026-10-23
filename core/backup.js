/* Original UTF-8/base64 wire compatibility, independently implemented. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./state.js'));else root.GroveBackup=factory(root.GroveState);})(globalThis,state=>{
 'use strict';
 function validateEnvelope(value){
  state.requireObject(value,'Backup');state.requireObject(value.PR,'Profile registry');state.requireObject(value.data,'Profile data');
  const registry=value.PR;if(!Array.isArray(registry.list))throw new Error('Profile list must be an array');
  const ids=new Set();for(const profile of registry.list){
   state.requireObject(profile,'Profile metadata');if(typeof profile.id!=='string'||!profile.id.trim()||ids.has(profile.id))throw new Error('Invalid or duplicate profile ID');
   for(const key of ['name','av','gr'])if(state.own(profile,key)&&typeof profile[key]!=='string')throw new Error('Invalid profile '+key);
   ids.add(profile.id);
  }
  if(ids.size?!ids.has(registry.cur):registry.cur!==null)throw new Error('Current profile is not listed');
  if(Object.keys(value.data).length!==ids.size||Object.keys(value.data).some(id=>!ids.has(id)))throw new Error('Backup must contain exactly its listed profiles');
  for(const id of ids){const raw=value.data[id];if(typeof raw!=='string'||!raw.trim())throw new Error('Missing child snapshot');state.validateProfile(JSON.parse(raw));}
  return value;
 }
 function decodeBackup(code,codec){
  if(typeof code!=='string')throw new Error('Backup code must be text');const compact=code.replace(/\s/g,'');
  if(!compact||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact))throw new Error('Invalid backup encoding');
  const value=validateEnvelope(JSON.parse(codec.decodeUtf8(compact)));
  return {registry:state.copy(value.PR),rawProfiles:state.copy(value.data),envelopeExtras:Object.fromEntries(Object.entries(value).filter(([key])=>key!=='PR'&&key!=='data'))};
 }
 function encodeBackup({registry,rawProfiles,envelopeExtras={}},codec){
  const value={...state.copy(envelopeExtras),PR:state.copy(registry),data:state.copy(rawProfiles)};validateEnvelope(value);return codec.encodeUtf8(JSON.stringify(value));
 }
 return {decodeBackup,encodeBackup,validateEnvelope};
});
