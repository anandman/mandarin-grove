/* Portable projection of retained completed rounds. Reading this never changes state or scores. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MandarinMistakes=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const modes=new Set(['listen','trace','flip','memory','dictation','words']);
 const methods={listen:{listen:'checked'},trace:{trace:'checked'},flip:{flip:'self-rated'},memory:{memory:'checked'},dictation:{pinyin:'checked',writing:'self-rated'},words:{words:'checked'}};
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const list=x=>Array.isArray(x)?x:[];
 const stable=x=>JSON.stringify(x,(_key,value)=>object(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
 const textOrder=(a,b)=>a<b?-1:a>b?1:0;
 function usableRound(round){
  if(!object(round)||!object(round.results)&&!Array.isArray(round.results))return false;
  // studyHistory is the completed store. A retained explicit unfinished cursor contradicts it.
  return !Array.isArray(round.q)||!Number.isFinite(round.cursor)||round.cursor>=round.q.length;
 }
 function uniqueRecords(entries,idOf){
  const signatures=new Map(),conflicts=new Set();
  for(const entry of entries){const id=idOf(entry);if(!id)continue;const signature=stable(entry);if(signatures.has(id)&&signatures.get(id)!==signature)conflicts.add(id);else signatures.set(id,signature);}
  const seen=new Set();return entries.filter(entry=>{const id=idOf(entry);if(!id)return true;if(conflicts.has(id)||seen.has(id))return false;seen.add(id);return true;});
 }
 function evidenceFor(row){
  if(!object(row)||!modes.has(row.mode)||typeof row.character!=='string'||!row.character)return [];
  const first=object(row.firstAttempt)?row.firstAttempt:{};
  if(row.ungraded||first.ungraded||first.skipped||['skip','ungraded','unverified','unknown'].includes(row.outcome)||['skip','ungraded','unverified','unknown'].includes(first.outcome))return [];
  if(row.version===1){
   if(!Array.isArray(row.evidence)||!object(row.firstAttempt)||!['correct','miss','assisted'].includes(first.outcome)||row.outcome!==first.outcome||row.correct!==(first.outcome==='correct')||first.assisted!==(first.outcome==='assisted')||first.skipped!==false||first.ungraded!==false)return [];
   const supported=row.evidence.filter(e=>object(e)&&methods[row.mode][e.skill]===e.method);
   const accepted=supported.filter(e=>['correct','miss','assisted'].includes(e.outcome));
   // A component may be unknown in an old partial record. Known components still
   // count, but a fully assessed question must agree with its first-attempt score.
   if(row.mode!=='dictation'){
    if(supported.some(e=>e.outcome!==first.outcome))return [];
   }else if(supported.some(e=>e.outcome!=='correct')&&first.outcome==='correct')return [];
   else if(['pinyin','writing'].every(skill=>supported.some(e=>e.skill===skill))&&supported.every(e=>['correct','miss','assisted'].includes(e.outcome))){
    const combined=supported.some(e=>e.outcome==='miss')?'miss':supported.some(e=>e.outcome==='assisted')?'assisted':'correct';
    if(combined!==first.outcome)return [];
   }
   const seen=new Map(),conflicts=new Set();
   for(const e of accepted){const key=e.skill+':'+e.method;if(seen.has(key)&&seen.get(key).outcome!==e.outcome)conflicts.add(key);else seen.set(key,e);}
   return [...seen.entries()].filter(([key])=>!conflicts.has(key)).map(([,e])=>({skill:e.skill,method:e.method,outcome:e.outcome,legacyCombined:false}));
  }
  // Explicit old outcomes are known; false alone could mean skipped or ungraded.
  if(row.version!==undefined||!['correct','miss','assisted'].includes(row.outcome))return [];
  const method=row.selfRated===true?'self-rated':row.selfRated===false?'checked':'unknown';
  if(method!=='unknown'&&method!==(row.mode==='dictation'?'self-rated':methods[row.mode][row.mode]))return [];
  return [{skill:row.mode==='dictation'?'combined':row.mode,method,outcome:row.outcome,legacyCombined:row.mode==='dictation'}];
 }
 /**
  * @param {object} state One child's saved state, never a registry of children.
  * @param {object} options catalog (cards or character IDs), characters/activities filters,
  * excluded character IDs (overrides saved eligibility for an editable draft), and finite
  * launch limit. Missing character/activity filters mean all available.
  * @returns {{needs:Array,resolved:Array,pairs:Array,hasDetails:boolean,rounds:number}}
  * Array append order is authoritative; old round dates cannot establish per-answer order.
  */
 function queryRecentMistakes(state,options={}){
  state=object(state)?state:{};options=object(options)?options:{};
  const retained=list(state.studyHistory).filter(usableRound).slice(-20);
  const rounds=uniqueRecords(retained,r=>typeof r.id==='string'&&r.id?r.id:null);
  const entries=[];
  rounds.forEach(round=>{
   const positions=new Map();
   list(round.q).forEach((pair,index)=>{if(Array.isArray(pair)&&!positions.has(pair[0]+':'+pair[1]))positions.set(pair[0]+':'+pair[1],index);});
   const rows=Object.values(round.results).filter(object).map((row,index)=>({row,index,position:positions.get(row.mode+':'+row.character)??Infinity}));
   rows.sort((a,b)=>a.position-b.position||a.index-b.index);
   rows.forEach(({row})=>entries.push({row,round}));
  });
  // Row IDs alone are insufficient: imported aliases may name the same question.
  // Quarantine all conflicting facts for a logical question before applying success.
  const identities=({row,round},roundIndex)=>[
   ...(typeof row.id==='string'&&row.id?['id:'+JSON.stringify(row.id)]:[]),
   ...(typeof row.sessionId==='string'&&row.sessionId&&typeof row.itemId==='string'&&row.itemId?['item:'+JSON.stringify([row.sessionId,row.itemId])]:[]),
   'round:'+JSON.stringify([roundIndex,row.mode,row.character])
  ];
  const roundIndexes=new Map(rounds.map((r,i)=>[r,i])),signatures=new Map(),conflicts=new Set();
  const facts=row=>stable({mode:row.mode,character:row.character,version:row.version,outcome:row.outcome,correct:row.correct,selfRated:row.selfRated,ungraded:row.ungraded,firstAttempt:row.firstAttempt,evidence:Array.isArray(row.evidence)?[...row.evidence].sort((a,b)=>textOrder(stable(a),stable(b))):row.evidence});
  for(const entry of entries){entry.keys=identities(entry,roundIndexes.get(entry.round));const signature=facts(entry.row);for(const key of entry.keys){if(signatures.has(key)&&signatures.get(key)!==signature)conflicts.add(key);else signatures.set(key,signature);}}
  const seen=new Set(),states=new Map();let order=0,hasDetails=false;
  for(const {row,round,keys}of entries){
   if(keys.some(key=>conflicts.has(key)||seen.has(key)))continue;
   keys.forEach(key=>seen.add(key));
   const evidence=evidenceFor(row);if(!evidence.length)continue;hasDetails=true;order++;
   const base={character:row.character,mode:row.mode,resultId:typeof row.id==='string'?row.id:null,sessionId:typeof row.sessionId==='string'?row.sessionId:typeof round.id==='string'?round.id:null,at:Number.isFinite(row.at)?row.at:null,order};
   const apply=e=>{
    const key=[row.character,row.mode,e.skill,e.method].join(':');
    const old=states.get(key);
    if(e.outcome==='correct'){
     if(old?.status==='needs-practice')states.set(key,{...old,status:'practiced-again',resolvedBy:base.resultId,resolvedOrder:order});
    }else states.set(key,{...base,...e,status:'needs-practice'});
   };
   evidence.forEach(apply);
   // A clean new combined answer can resolve the earlier unsplit self-rated activity,
   // but one positive component cannot claim success for the missing component.
   if(row.mode==='dictation'&&row.version===1&&row.outcome==='correct'&&row.correct===true&&row.firstAttempt?.outcome==='correct'&&!row.firstAttempt.assisted&&evidence.some(e=>e.skill==='pinyin'&&e.method==='checked'&&e.outcome==='correct')&&evidence.some(e=>e.skill==='writing'&&e.method==='self-rated'&&e.outcome==='correct')){
    apply({skill:'combined',method:'self-rated',outcome:'correct',legacyCombined:true});
   }
  }
  const catalog=new Set(list(options.catalog).map(c=>typeof c==='string'?c:c?.c).filter(c=>typeof c==='string'));
  const chars=Array.isArray(options.characters)?new Set(options.characters):null;
  const activities=Array.isArray(options.activities)?new Set(options.activities):modes;
  const excluded=new Set(Array.isArray(options.excluded)?options.excluded:list(state.cfg?.notLearned));
  const groups=status=>{
   const grouped=new Map();
   for(const e of states.values()){
    if(e.status!==status||!catalog.has(e.character)||excluded.has(e.character)||chars&&!chars.has(e.character)||!activities.has(e.mode))continue;
    const key=e.mode+':'+e.character;
    if(!grouped.has(key))grouped.set(key,{character:e.character,mode:e.mode,status,order:e.order,needs:[]});
    const group=grouped.get(key);group.needs.push({...e});group.order=Math.max(group.order,e.order);
   }
   return [...grouped.values()].sort((a,b)=>b.order-a.order||textOrder(a.character,b.character)||textOrder(a.mode,b.mode));
  };
  const needs=groups('needs-practice'),resolved=groups('practiced-again');
  const limit=[5,10,20,30].includes(Number(options.limit))?Number(options.limit):30;
  return {needs,resolved,pairs:needs.slice(0,limit).map(e=>[e.mode,e.character]),hasDetails,rounds:rounds.length};
 }
 return {queryRecentMistakes};
});
