const test=require('node:test'),assert=require('node:assert/strict');let api;try{api=require('../core/results.js');}catch{}
const deps={now:()=>123,makeId:()=> 'result-1'};
test('new dictation keeps checked pinyin separate from self-rated writing without changing question score',()=>{
 assert.equal(typeof api?.createResult,'function');const result=api.createResult({character:'狗',mode:'dictation',sessionId:'round1',itemId:'dictation:狗',correct:false,outcome:'miss',selfRated:true,evidence:[{skill:'pinyin',method:'checked',outcome:'miss'},{skill:'writing',method:'self-rated',outcome:'correct'}]},deps);
 assert.deepEqual(result.evidence,[{skill:'pinyin',method:'checked',outcome:'miss'},{skill:'writing',method:'self-rated',outcome:'correct'}]);assert.equal(result.correct,false);assert.equal(result.firstAttempt.outcome,'miss');assert.equal(result.at,123);assert.equal(result.id,'result-1');
});
test('unknown, skip and assisted outcomes remain explicit and raw answers are not needed',()=>{
 for(const [outcome,expected]of [['unverified','ungraded'],['skip','skip'],['assisted','assisted']]){
  const r=api.createResult({character:'绿',mode:'words',outcome,correct:false},deps);assert.equal(r.firstAttempt.outcome,expected);assert.equal(r.firstAttempt.skipped,outcome==='skip');assert.equal(r.firstAttempt.ungraded,outcome==='unverified');assert.equal(r.firstAttempt.assisted,outcome==='assisted');
 }
});
test('first-result recording is detached and never rewrites an earlier score after retry',()=>{
 const round={results:{}},r=api.createResult({character:'狗',mode:'listen',outcome:'miss',correct:false},deps);
 assert.equal(api.recordFirstResult(round,'listen:狗',r),true);r.evidence[0].outcome='correct';const old=JSON.stringify(round);
 assert.equal(api.recordFirstResult(round,'listen:狗',api.createResult({character:'狗',mode:'listen',outcome:'correct',correct:true},deps)),false);assert.equal(JSON.stringify(round),old);assert.equal(round.results['listen:狗'].evidence[0].outcome,'miss');
});
test('legacy combined and partial results remain unknown at component level without mutation',()=>{
 const round={results:{'dictation:狗':{character:'狗',mode:'dictation',correct:false,outcome:'miss',selfRated:true},'listen:绿':{character:'绿',mode:'listen',correct:false},'words:女':{character:'女',mode:'words',correct:false,outcome:'unverified',ungraded:true}}},old=JSON.stringify(round),facts=api.legacyResultFacts(round);
 assert.deepEqual(facts.map(x=>[x.character,x.outcome,x.evidence.length]),[['狗','miss',0],['绿','unknown',0],['女','ungraded',0]]);assert.equal(JSON.stringify(round),old);
});
test('only supported finalized skill evidence can become a new result',()=>{
 assert.throws(()=>api.createResult({character:'狗',mode:'dictation',outcome:'correct',evidence:[{skill:'pinyin',method:'model guessed',outcome:'correct'}]},deps),Error);
 assert.throws(()=>api.createResult({character:'狗',mode:'dictation',outcome:'correct'},deps),/evidence|component/i);
});
