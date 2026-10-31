// Release research only. Measured component evidence never authorizes release alone.
const fs=require('node:fs');
const crypto=require('node:crypto');
const {phonemes}=require('./audio-natural-benchmark.cjs');
const COMPONENTS=['initial','final','tone'],SHA=/^[a-f0-9]{64}$/;
const DEFAULT_GATES={minPositives:100,minControls:100,minPrecision:.99,maxFalseAcceptRate:.01,minCoverage:.8,minSpeakers:2,minCriticalPairs:1,minCriticalCoverage:.8};
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 return value;
}
function hash(value){return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}
function identity(capture,policy,{manifest,qualification={}}={}){
 return{weightsSha256:capture.weightsSha256,featureCodeSha256:capture.featureCodeSha256,
  fittedSpeakers:[...capture.fittedSpeakers].sort(),policySha256:hash(policy),
  evaluatorCodeSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
  parserCodeSha256:crypto.createHash('sha256').update(fs.readFileSync(require.resolve('./audio-natural-benchmark.cjs'))).digest('hex'),
  referenceManifestSha256:manifest?hash(manifest):null,criticalContrastsSha256:manifest?hash(manifest.criticalContrasts||[]):null,
  qualificationSha256:hash({...DEFAULT_GATES,...qualification})};
}
function counts(){return{total:0,matches:0,mismatch:0,abstained:0}}
function negativeCounts(){return{total:0,falseAccepted:0,rejected:0,abstained:0}}
function finish(c){const accepted=c.matches+c.mismatch;return{...c,accepted,precision:accepted?c.matches/accepted:null,coverage:c.total?accepted/c.total:0}}
function decision(scores,policy){
 if(!scores||!Object.keys(scores).length)return{status:'abstained',reason:'unmeasured'};
 if(typeof scores!=='object'||Array.isArray(scores))throw Error('Invalid component scores');
 const ranked=Object.entries(scores);
 if(ranked.some(([label,score])=>typeof label!=='string'||!Number.isFinite(score)||score<0||score>1))throw Error('Invalid component score');
 const sum=ranked.reduce((n,[,score])=>n+score,0);
 if(Math.abs(sum-1)>1e-5)throw Error('Expected normalized model scores, not correctness probabilities');
 ranked.sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 const [observed,score]=ranked[0],margin=score-(ranked[1]?.[1]||0);
 const labelMinimum=policy.minScoreByLabel&&Object.hasOwn(policy.minScoreByLabel,observed)?policy.minScoreByLabel[observed]:0;
 if(margin<=0||score<Math.max(policy.minScore,labelMinimum)||margin<policy.minMargin)return{status:'abstained',reason:'below-calibrated-threshold',observed,score,margin};
 if(policy.allowedLabels&&!policy.allowedLabels.includes(observed))return{status:'abstained',reason:'unsupported-label',observed,score,margin};
 return{status:'measured',observed,score,margin};
}
function verify(manifest,capture,policy,{frozen,qualification={}}={}){
 if(manifest.schemaVersion!==1||!Array.isArray(manifest.clips)||!manifest.clips.length||capture.schemaVersion!==1||capture.input!=='audio-only'||!Array.isArray(capture.predictions)||!Array.isArray(capture.fittedSpeakers)||!capture.fittedSpeakers.length||!SHA.test(capture.weightsSha256)||!SHA.test(capture.featureCodeSha256))throw Error('Expected identified audio-only component evidence');
 for(const component of COMPONENTS){const p=policy[component];
  if(!p||!Number.isFinite(p.minScore)||p.minScore<0||p.minScore>1||!Number.isFinite(p.minMargin)||p.minMargin<0||p.minMargin>1)throw Error('Invalid calibration policy');
  if(p.minScoreByLabel!==undefined&&(!p.minScoreByLabel||typeof p.minScoreByLabel!=='object'||Array.isArray(p.minScoreByLabel)||Object.values(p.minScoreByLabel).some(v=>!Number.isFinite(v)||v<0||v>1)))throw Error('Invalid label calibration policy');
  if(p.allowedLabels!==undefined&&(!Array.isArray(p.allowedLabels)||p.allowedLabels.some(v=>typeof v!=='string')||new Set(p.allowedLabels).size!==p.allowedLabels.length))throw Error('Invalid calibration label allowlist');
 }
 const ids=new Set(),audioHashes=new Set(),readings=new Map(),speakers=new Map();
 for(const c of manifest.clips){
  if(c.referenceEligible!==undefined&&c.referenceEligible!==true)throw Error('Unlabelled normalization rows cannot enter reference evaluation');
  const parts=phonemes(c.pinyin);
  if(!c.id||ids.has(c.id)||audioHashes.has(c.sha256)||!parts||!SHA.test(c.sha256)||!c.speaker||!['development','calibration','held-out'].includes(c.split))throw Error('Invalid or duplicate reference clip/audio');
  if(speakers.has(c.speaker)&&speakers.get(c.speaker)!==c.split)throw Error('Speaker crosses reference splits');
  ids.add(c.id);audioHashes.add(c.sha256);readings.set(c.pinyin,parts);speakers.set(c.speaker,c.split);
 }
 const held=manifest.clips.some(c=>c.split==='held-out');
 if(held&&(!frozen||hash(frozen)!==hash(identity(capture,policy,{manifest,qualification}))))throw Error('Held-out evaluation requires matching frozen method/reference/gate identity');
 if(manifest.clips.some(c=>c.split!=='development'&&capture.fittedSpeakers.includes(c.speaker)))throw Error('Evaluation speaker was fitted by the model');
 const critical=manifest.criticalContrasts||[];
 if(!Array.isArray(critical)||critical.some(p=>!Array.isArray(p)||p.length!==2||p[0]===p[1]||p.some(k=>!phonemes(k))))throw Error('Invalid critical contrasts');
 const predictions=new Map();
 for(const p of capture.predictions){
  if(!ids.has(p.clipId)||predictions.has(p.clipId))throw Error('Unknown or duplicate prediction');
  // Validate every supplied score, including records later quarantined by hash.
  for(const component of COMPONENTS)if(p.scores?.[component])decision(p.scores[component],policy[component]);
  predictions.set(p.clipId,p);
 }
 const positive=Object.fromEntries(COMPONENTS.map(k=>[k,counts()])),negatives=Object.fromEntries(COMPONENTS.map(k=>[k,negativeCounts()]));
 const bySpeaker={},byBase={},byLabel=Object.fromEntries(COMPONENTS.map(k=>[k,{}])),byObservedLabel=Object.fromEntries(COMPONENTS.map(k=>[k,{}])),results=[],contrasts=[],issues=[],criticalCounts=negativeCounts(),full=counts(),disposition=counts();
 function add(target,result){target.total++;target[result]++}
 for(const clip of manifest.clips){
  const expected=phonemes(clip.pinyin),prediction=predictions.get(clip.id),bound=prediction&&prediction.sha256===clip.sha256;
  if(!bound)issues.push({clipId:clip.id,reason:prediction?'audio-hash-mismatch':'missing-prediction'});
  const components={};
  bySpeaker[clip.speaker]??=Object.fromEntries(COMPONENTS.map(k=>[k,counts()]));
  const base=clip.pinyin.slice(0,-1);byBase[base]??=Object.fromEntries(COMPONENTS.map(k=>[k,counts()]));
  for(const component of COMPONENTS){
   let d=bound?decision(prediction.scores?.[component],policy[component]):{status:'abstained',reason:'unbound-audio'};
   if(component==='tone'&&expected.tone==='5')d={status:'abstained',reason:'neutral-context-required'};
   if(d.status==='measured')d={...d,status:d.observed===expected[component]?'matches':'mismatch'};
   components[component]=d;add(positive[component],d.status);add(bySpeaker[clip.speaker][component],d.status);
   add(byBase[base][component],d.status);
   add(byLabel[component][expected[component]]??=counts(),d.status);
   if(d.status!=='abstained')add(byObservedLabel[component][d.observed]??=counts(),d.status);
   const possible=[...readings.entries()].filter(([key,parts])=>key!==clip.pinyin&&COMPONENTS.filter(k=>parts[k]!==expected[k]).length===1&&parts[component]!==expected[component]);
   possible.sort(([ka,a],[kb,b])=>(prediction?.scores?.[component]?.[b[component]]||0)-(prediction?.scores?.[component]?.[a[component]]||0)||ka.localeCompare(kb));
   if(possible.length){
    const [wrongPinyin,parts]=possible[0],result=d.status==='abstained'?'abstained':d.observed===parts[component]?'falseAccepted':'rejected';
    add(negatives[component],result);contrasts.push({clipId:clip.id,component,truePinyin:clip.pinyin,wrongPinyin,result});
   }
  }
  for(const pair of critical){
   if(!pair.includes(clip.pinyin))continue;
   const wrongPinyin=pair.find(x=>x!==clip.pinyin);if(!readings.has(wrongPinyin))continue;
   const parts=readings.get(wrongPinyin),changed=COMPONENTS.filter(k=>expected[k]!==parts[k]);
   const result=COMPONENTS.every(k=>components[k].status!=='abstained'&&components[k].observed===parts[k])?'falseAccepted':changed.some(k=>components[k].status!=='abstained'&&components[k].observed!==parts[k])?'rejected':'abstained';
   add(criticalCounts,result);contrasts.push({clipId:clip.id,component:'critical',truePinyin:clip.pinyin,wrongPinyin,result});
  }
  const diagnostic=COMPONENTS.every(k=>components[k].status==='matches')?'matches':COMPONENTS.some(k=>components[k].status==='mismatch')?'mismatch':'abstained';
  const status=COMPONENTS.some(k=>components[k].status==='abstained')?'abstained':diagnostic;
  add(disposition,diagnostic);add(full,status);results.push({clipId:clip.id,pinyin:clip.pinyin,speaker:clip.speaker,split:clip.split,components,status,disposition:diagnostic});
 }
 const criticalRows=contrasts.filter(x=>x.component==='critical');
 const criticalCoverage={declaredPairs:critical.length,representedPairs:critical.filter(pair=>pair.every(key=>readings.has(key))).length,
  measuredPairs:critical.filter(pair=>criticalRows.some(row=>row.result!=='abstained'&&pair.includes(row.truePinyin)&&pair.includes(row.wrongPinyin))).length,
  decisionCoverage:criticalRows.length?(criticalCounts.rejected+criticalCounts.falseAccepted)/criticalRows.length:0,
  directedPairs:new Set(criticalRows.map(x=>x.truePinyin+'|'+x.wrongPinyin)).size,distinctClips:new Set(criticalRows.map(x=>x.clipId)).size,
  untestedPairs:critical.filter(pair=>pair.some(key=>!readings.has(key))).map(pair=>({pair,missingReadings:pair.filter(key=>!readings.has(key))}))};
 return{schemaVersion:1,canPromote:false,
  limitations:'Agreement with published natural references, not infallible acoustic truth. Reused component contrasts are dependent; scores are not correctness probabilities. No child-speech or universal accent claim.',
  countUnit:'One natural clip per positive; at most one hardest represented one-component contrast per clip/component. Components and critical pairs reuse clips.',
  methodIdentity:identity(capture,policy,{manifest,qualification}),qualificationConfig:{...DEFAULT_GATES,...qualification},frozenEvaluation:held,uniqueClips:manifest.clips.length,
  positive:Object.fromEntries(COMPONENTS.map(k=>[k,finish(positive[k])])),negatives,critical:criticalCounts,criticalCoverage,full:finish(full),disposition,
  bySpeaker:Object.fromEntries(Object.entries(bySpeaker).map(([speaker,c])=>[speaker,Object.fromEntries(COMPONENTS.map(k=>[k,finish(c[k])]))])),
  byBase:Object.fromEntries(Object.entries(byBase).map(([base,c])=>[base,Object.fromEntries(COMPONENTS.map(k=>[k,finish(c[k])]))])),
  byLabel:Object.fromEntries(COMPONENTS.map(k=>[k,Object.fromEntries(Object.entries(byLabel[k]).map(([label,c])=>[label,finish(c)]))])),
  byObservedLabel:Object.fromEntries(COMPONENTS.map(k=>[k,Object.fromEntries(Object.entries(byObservedLabel[k]).map(([label,c])=>[label,finish(c)]))])),
  sampling:{speakers:speakers.size,readingBases:Object.keys(byBase).length,readings:readings.size,
   pairedReadings:[...readings.keys()].filter(key=>new Set(manifest.clips.filter(c=>c.pinyin===key).map(c=>c.speaker)).size>=2).length},issues,results,contrasts};
}
function qualify(report,options){
 const gates=options?{...DEFAULT_GATES,...options}:report.qualificationConfig||DEFAULT_GATES;
 if(report.frozenEvaluation&&hash(gates)!==hash(report.qualificationConfig))throw Error('Qualification gates differ from frozen evaluation');
 if(report.frozenEvaluation&&hash(report.qualificationConfig)!==report.methodIdentity.qualificationSha256)throw Error('Frozen qualification gate identity changed');
 const {minPositives,minControls,minPrecision,maxFalseAcceptRate,minCoverage,minSpeakers,minCriticalPairs,minCriticalCoverage}=gates;
 if([minPositives,minControls,minSpeakers,minCriticalPairs].some(x=>!Number.isInteger(x)||x<1)||[minPrecision,maxFalseAcceptRate,minCoverage,minCriticalCoverage].some(x=>!Number.isFinite(x)||x<0||x>1))throw Error('Invalid acceptance gate thresholds');
 const components={};
 for(const k of COMPONENTS){const p=report.positive[k],n=report.negatives[k];
  components[k]={passed:p.total>=minPositives&&p.precision!==null&&p.precision>=minPrecision&&p.coverage>=minCoverage&&n.total>=minControls&&n.falseAccepted/n.total<=maxFalseAcceptRate,
   positives:p.total,accepted:p.accepted,precision:p.precision,coverage:p.coverage,controls:n.total,falseAccepted:n.falseAccepted};
 }
 const speakerCount=Object.keys(report.bySpeaker).length;
 const speakerPassed=Object.values(report.bySpeaker).every(c=>COMPONENTS.every(k=>c[k].precision!==null&&c[k].precision>=minPrecision&&c[k].coverage>=minCoverage));
 return{passed:COMPONENTS.every(k=>components[k].passed)&&speakerCount>=minSpeakers&&speakerPassed&&report.criticalCoverage.measuredPairs>=minCriticalPairs&&report.criticalCoverage.decisionCoverage>=minCriticalCoverage&&report.critical.falseAccepted===0&&report.issues.length===0,components,speakerCount,speakerPassed,criticalFalseAccepted:report.critical.falseAccepted,criticalCoverage:report.criticalCoverage,canPromote:false};
}
module.exports={verify,qualify,identity,hash,DEFAULT_GATES};
if(require.main===module){
 try{const [m,c,p,out,f]=process.argv.slice(2);if(!m||!c||!p||!out)throw Error('Usage: node scripts/audio-acceptance.cjs MANIFEST CAPTURE POLICY NEW_OUTPUT [FROZEN_IDENTITY]');
  const read=x=>JSON.parse(fs.readFileSync(x)),report=verify(read(m),read(c),read(p),f?{frozen:read(f)}:{});
  fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({positive:report.positive,negatives:report.negatives,critical:report.critical,qualification:qualify(report)},null,2));
 }catch(e){console.error(e.message);process.exitCode=1}
}
