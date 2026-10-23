/* Independent, portable profile boundary. No storage, clock or UI side effects. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GroveState=api;})(globalThis,()=>{
 'use strict';
 const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const copy=value=>JSON.parse(JSON.stringify(value));
 function requireObject(value,label){if(!object(value))throw new Error(label+' must be an object');}
 function optional(value,key,check,label){if(own(value,key)&&value[key]!==undefined&&!check(value[key]))throw new Error((label||key)+' has an unsupported value');}
 const strings=value=>Array.isArray(value)&&value.every(x=>typeof x==='string');
 const count=value=>Number.isFinite(value)&&value>=0;
 function round(value,label){
  requireObject(value,label);
  optional(value,'q',q=>Array.isArray(q)&&q.every(pair=>Array.isArray(pair)&&pair.length===2&&pair.every(x=>typeof x==='string')),label+'.q');
  for(const key of ['cursor','i'])optional(value,key,n=>Number.isInteger(n)&&n>=0,label+'.'+key);
  for(const key of ['results','attempts'])if(own(value,key)){requireObject(value[key],label+'.'+key);for(const row of Object.values(value[key]))requireObject(row,label+'.'+key+' record');}
  if(own(value,'config'))choices(value.config,label+'.config');
 }
 function choices(value,label){
  requireObject(value,label);
  for(const key of ['units','chars','modes'])optional(value,key,strings,label+'.'+key);
  optional(value,'limit',n=>Number.isInteger(n)&&n>0,label+'.limit');
 }
 function resumable(value,label,type,kind){
  round(value,label);
  const queue=value.q,index=type==='study'?value.cursor:value.i;
  if(!Array.isArray(queue)||!Number.isInteger(index)||index<0||index>queue.length)throw new Error(label+' needs a complete queue and cursor');
  if(type==='study'){
   if(typeof value.id!=='string'||!value.id||value.kind!==kind)throw new Error(label+' needs a supported round identity');
   choices(value.config,label+'.config');requireObject(value.results,label+'.results');
   for(const key of ['units','chars','modes'])if(!strings(value.config[key]))throw new Error(label+' needs saved '+key);
   if(!Number.isInteger(value.config.limit)||value.config.limit<=0)throw new Error(label+' needs a saved question limit');
  }else if(type==='cram'&&!strings(value.p))throw new Error(label+' needs its character pool');
 }
 function validateProfile(value){
  requireObject(value,'Profile');
  for(const key of ['stars','streak'])optional(value,key,count);
  optional(value,'last',x=>typeof x==='string');
  for(const key of ['pts','box','due','ok','bad'])if(own(value,key)){
   requireObject(value[key],key);
   if(['pts','box','due'].includes(key))for(const n of Object.values(value[key]))if(!count(n))throw new Error(key+' contains an invalid counter');
  }
  if(own(value,'cfg')&&value.cfg!==null){
   const cfg=value.cfg;requireObject(cfg,'cfg');
   for(const key of ['test','quiz'])optional(cfg,key,x=>typeof x==='string','cfg.'+key);
   optional(cfg,'set',x=>x===null||strings(x),'cfg.set');optional(cfg,'notLearned',strings,'cfg.notLearned');
   if(own(cfg,'sets')){requireObject(cfg.sets,'cfg.sets');for(const x of Object.values(cfg.sets))if(x!==null&&!strings(x))throw new Error('Invalid grade selection');}
   if(own(cfg,'past')){if(!Array.isArray(cfg.past))throw new Error('cfg.past must be an array');for(const x of cfg.past){requireObject(x,'Past quiz');optional(x,'q',v=>typeof v==='string');optional(x,'d',v=>typeof v==='string');}}
   if(own(cfg,'cramUnits')){requireObject(cfg.cramUnits,'cfg.cramUnits');for(const x of Object.values(cfg.cramUnits))if(!Array.isArray(x)||!x.every(v=>typeof v==='string'||Number.isFinite(v)))throw new Error('Invalid unit selections');}
   for(const key of ['rs','cram'])if(own(cfg,key)&&cfg[key]!==null)resumable(cfg[key],'cfg.'+key,key);
   if(own(cfg,'cramDict')&&cfg.cramDict!==null){const saved=cfg.cramDict;requireObject(saved,'cfg.cramDict');if(!strings(saved.q)||!strings(saved.pool)||!Number.isInteger(saved.i)||saved.i<0||saved.i>saved.q.length)throw new Error('cfg.cramDict needs a complete queue, cursor and pool');for(const key of ['bad','score','n'])optional(saved,key,count,'cfg.cramDict.'+key);}
   for(const key of ['studyChoices','studyRounds'])if(own(cfg,key)){
    requireObject(cfg[key],'cfg.'+key);for(const grade of Object.values(cfg[key])){requireObject(grade,'Saved grade');for(const [kind,row]of Object.entries(grade))if(row!==null){if(key==='studyChoices')choices(row,key);else if(['practice','review'].includes(kind))resumable(row,key,'study',kind);else round(row,key);}}
   }
  }
  if(own(value,'learning')){
   requireObject(value.learning,'learning');for(const key of ['chars','days'])if(own(value.learning,key))requireObject(value.learning[key],'learning.'+key);
   for(const row of Object.values(value.learning.chars||{})){
    requireObject(row,'Character evidence');if(own(row,'skills')){requireObject(row.skills,'Skills');for(const skill of Object.values(row.skills)){requireObject(skill,'Skill evidence');for(const key of ['attempts','correct','assisted','skips','misses','level','due'])optional(skill,key,count,'Skill '+key);}}
   }
  }
  if(own(value,'rewards')){requireObject(value.rewards,'rewards');for(const key of ['characters','achievements'])if(own(value.rewards,key))requireObject(value.rewards[key],'rewards.'+key);optional(value.rewards,'ribbons',count);}
  if(own(value,'groveRewards')){
   const wallet=value.groveRewards;requireObject(wallet,'groveRewards');for(const key of ['owned','sentenceClaims'])optional(wallet,key,strings);
   optional(wallet,'transactions',Array.isArray);for(const key of ['equipped','projects','collections','legacyCredit'])if(own(wallet,key)&&wallet[key]!==null)requireObject(wallet[key],'Wallet '+key);
   for(const key of ['balance','creditedRibbons','ribbonFruitTotal','writingSentences'])optional(wallet,key,count);
  }
  if(own(value,'studyHistory')){if(!Array.isArray(value.studyHistory))throw new Error('studyHistory must be an array');for(const row of value.studyHistory)round(row,'Historical round');}
  if(own(value,'wordPractice')){requireObject(value.wordPractice,'wordPractice');if(own(value.wordPractice,'words')){requireObject(value.wordPractice.words,'Word collection');for(const words of Object.values(value.wordPractice.words))if(!strings(words))throw new Error('Invalid word collection');}}
  if(own(value,'homeworkHelp')){requireObject(value.homeworkHelp,'homeworkHelp');if(own(value.homeworkHelp,'summary')){requireObject(value.homeworkHelp.summary,'Summary');for(const key of ['reading','mainIdea','details','summary'])optional(value.homeworkHelp.summary,key,x=>typeof x==='string');}}
  return value;
 }
 function emptyProfile(){return {stars:0,streak:0,last:'',pts:{},box:{},due:{},cfg:{test:'',quiz:''}};}
 function prepareProfile(raw,{migrate=s=>s,now}={}){
  let value=typeof raw==='string'?JSON.parse(raw):copy(raw);validateProfile(value);
  const defaults=emptyProfile();for(const [key,fallback]of Object.entries(defaults))if(!own(value,key)||key==='cfg'&&value.cfg===null)value[key]=fallback;
  value=migrate(value,now)||value;validateProfile(value);return value;
 }
 return {own,isObject:object,copy,requireObject,validateProfile,emptyProfile,prepareProfile};
});
