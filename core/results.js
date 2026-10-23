/* A question score and its independently assessed skill evidence are separate. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GroveResults=api;})(globalThis,()=>{
 const copy=value=>JSON.parse(JSON.stringify(value));
 const outcomes=new Set(['correct','miss','assisted','skip','ungraded','unknown']);
 const outcome=value=>value==='unverified'?'ungraded':outcomes.has(value)?value:'unknown';
 function createResult(input,{now=Date.now,makeId=()=>Math.random().toString(36).slice(2)}={}){
  if(typeof input.character!=='string'||typeof input.mode!=='string')throw new Error('Result needs a character and activity');
  const first=outcome(input.outcome);let evidence=input.evidence;
  if(!evidence){
   if(input.mode==='dictation'&&!['skip','ungraded','unknown'].includes(first))throw new Error('Dictation requires explicit component evidence');
   evidence=input.mode==='dictation'?[]:[{skill:input.mode,method:input.mode==='flip'?'self-rated':'checked',outcome:first}];
  }
  if(!Array.isArray(evidence)||evidence.some(e=>!e||typeof e.skill!=='string'||!['checked','self-rated'].includes(e.method)||!outcomes.has(e.outcome)))throw new Error('Invalid skill evidence');
  return {...copy(input),version:1,id:input.id||makeId(),at:input.at??now(),firstAttempt:{outcome:first,assisted:first==='assisted',skipped:first==='skip',ungraded:first==='ungraded'},evidence:copy(evidence)};
 }
 function recordFirstResult(round,key,result){
  round.results||={};if(Object.prototype.hasOwnProperty.call(round.results,key))return false;Object.defineProperty(round.results,key,{value:copy(result),enumerable:true,writable:true,configurable:true});return true;
 }
 function legacyResultFacts(round){
  return Object.values(round.results||{}).filter(r=>r&&typeof r==='object').map(r=>({character:r.character,activity:r.mode,outcome:r.ungraded?'ungraded':outcome(r.outcome),evidence:r.version===1&&Array.isArray(r.evidence)?copy(r.evidence):[],combined:r.mode==='dictation'&&r.version!==1}));
 }
 return {createResult,recordFirstResult,legacyResultFacts};
});
