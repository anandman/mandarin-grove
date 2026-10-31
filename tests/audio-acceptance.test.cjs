const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const modulePath=path.join(__dirname,'../scripts/audio-acceptance.cjs');
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
function api(){assert.ok(fs.existsSync(modulePath),'Component acceptance evaluator is missing');return require(modulePath);}
function fixture(split='calibration'){
 const {phonemes}=require('../scripts/audio-natural-benchmark.cjs');
 const clips=['ge1','ke1','gu1','ku1','lv4','lu4','zi3','zhi3','ge2','ge3','ge4'].map((reading,i)=>({id:`clip-${i}`,pinyin:reading,sha256:hash(reading),speaker:'test-speaker',split}));
 const categories={};for(const c of ['initial','final','tone'])categories[c]=[...new Set(clips.map(x=>phonemes(x.pinyin)[c]))];
 const predictions=clips.map(c=>({clipId:c.id,sha256:c.sha256,scores:Object.fromEntries(['initial','final','tone'].map(k=>[k,Object.fromEntries(categories[k].map(label=>[label,label===phonemes(c.pinyin)[k]?.99:.01/(categories[k].length-1)]))]))}));
 const capture={schemaVersion:1,input:'audio-only',fittedSpeakers:['training-speaker'],weightsSha256:hash('weights'),featureCodeSha256:hash('features'),predictions};
 const manifest={schemaVersion:1,clips,criticalContrasts:[['zi3','zhi3']]};
 const policy=Object.fromEntries(['initial','final','tone'].map(k=>[k,{minScore:.9,minMargin:.1}]));
 return{manifest,capture,policy};
}

test('component evidence and one hardest represented natural contrast per clip stay separate',()=>{
 const {verify}=api(),f=fixture(),r=verify(f.manifest,f.capture,f.policy);
 assert.equal(r.full.matches,f.manifest.clips.length);assert.equal(r.canPromote,false);
 for(const c of ['initial','final','tone']){
  assert.equal(r.positive[c].precision,1);assert.equal(r.positive[c].coverage,1);
  assert.equal(r.negatives[c].falseAccepted,0);
  assert.ok(r.negatives[c].total<=f.manifest.clips.length);
 }
 assert.equal(r.critical.total,2);assert.equal(r.critical.falseAccepted,0);
 assert.equal(r.bySpeaker['test-speaker'].initial.total,f.manifest.clips.length);
});

test('confident initial error false-accepts a genuinely represented wrong reading',()=>{
 const {verify}=api(),f=fixture();
 f.capture.predictions[0].scores.initial=structuredClone(f.capture.predictions[1].scores.initial);
 const r=verify(f.manifest,f.capture,f.policy);
 assert.equal(r.positive.initial.mismatch,1);assert.equal(r.negatives.initial.falseAccepted,1);
 assert.equal(r.full.matches,f.manifest.clips.length-1);
 const contrast=r.contrasts.find(c=>c.clipId==='clip-0'&&c.component==='initial');
 assert.equal(contrast.wrongPinyin,'ke1');assert.equal(contrast.result,'falseAccepted');
 assert.equal(r.byObservedLabel.initial.k.matches,2);
 assert.equal(r.byObservedLabel.initial.k.mismatch,1);
});

test('stale/missing acoustic bytes and incomplete components abstain rather than approve',()=>{
 const {verify}=api(),f=fixture();
 f.capture.predictions[0].sha256=hash('changed');delete f.capture.predictions[1].scores.final;
 f.capture.predictions.splice(2,1);
 const r=verify(f.manifest,f.capture,f.policy);
 assert.equal(r.positive.initial.abstained,2);assert.equal(r.positive.final.abstained,3);
 assert.equal(r.full.matches,f.manifest.clips.length-3);assert.equal(r.issues.length,2);
});

test('unmeasured neutral tone stays unsupported despite confident four-tone predictions',()=>{
 const {verify}=api(),f=fixture();f.manifest.clips[0].pinyin='ma5';
 const r=verify(f.manifest,f.capture,f.policy);
 assert.equal(r.results[0].components.tone.status,'abstained');
 assert.equal(r.results[0].components.tone.reason,'neutral-context-required');
});

test('audio-only identity, score validity and duplicate clips fail closed',()=>{
 const {verify}=api();
 for(const mutate of [f=>f.capture.input='expected-text',f=>f.capture.predictions.push(f.capture.predictions[0]),f=>f.manifest.clips.push(f.manifest.clips[0]),f=>f.capture.predictions[0].scores.tone={'1':NaN},f=>f.capture.predictions[0].scores.tone={'1':1.1}]){
  const f=fixture();mutate(f);assert.throws(()=>verify(f.manifest,f.capture,f.policy));
 }
});

test('ties and uncertain scores abstain, and empty acceptance has no invented precision',()=>{
 const {verify}=api(),f=fixture();
 for(const p of f.capture.predictions)p.scores.tone={'1':.5,'2':.5};
 const r=verify(f.manifest,f.capture,f.policy);
 assert.equal(r.positive.tone.precision,null);assert.equal(r.positive.tone.coverage,0);
 assert.equal(r.full.matches,0);
});

test('final evaluation requires frozen policy/model identity and excludes fitted speakers',()=>{
 const {verify,identity}=api(),f=fixture('held-out');
 assert.throws(()=>verify(f.manifest,f.capture,f.policy),/frozen/i);
 assert.throws(()=>verify(f.manifest,f.capture,f.policy,{frozen:identity(f.capture,f.policy)}),/frozen|manifest/i);
 const frozen=identity(f.capture,f.policy,{manifest:f.manifest});
 assert.equal(verify(f.manifest,f.capture,f.policy,{frozen}).full.matches,f.manifest.clips.length);
 f.policy.tone.minScore=.8;assert.throws(()=>verify(f.manifest,f.capture,f.policy,{frozen}),/frozen/i);
 const g=fixture('held-out');g.capture.fittedSpeakers=['test-speaker'];
 assert.throws(()=>verify(g.manifest,g.capture,g.policy,{frozen:identity(g.capture,g.policy,{manifest:g.manifest})}),/fitted|speaker/i);
});

test('qualification requires measured precision, coverage and natural controls for every component',()=>{
 const {verify,qualify}=api(),f=fixture(),r=verify(f.manifest,f.capture,f.policy);
 assert.equal(qualify(r,{minPositives:5,minControls:1,minPrecision:.99,maxFalseAcceptRate:.01,minCoverage:.8,minSpeakers:1}).passed,true);
 assert.equal(qualify(r,{minPositives:100,minControls:1,minPrecision:.99,maxFalseAcceptRate:.01,minCoverage:.8}).passed,false);
 f.capture.predictions[0].scores.initial=structuredClone(f.capture.predictions[1].scores.initial);
 const bad=verify(f.manifest,f.capture,f.policy);
 assert.equal(qualify(bad,{minPositives:5,minControls:1,minPrecision:.99,maxFalseAcceptRate:.01,minCoverage:.8}).passed,false);
});

test('duplicated audio bytes cannot inflate supposedly independent reference counts',()=>{
 const {verify}=api(),f=fixture();
 f.manifest.clips.push({...f.manifest.clips[0],id:'duplicate-bytes',speaker:'another-speaker'});
 f.capture.predictions.push({...f.capture.predictions[0],clipId:'duplicate-bytes'});
 assert.throws(()=>verify(f.manifest,f.capture,f.policy),/duplicate|audio/i);
});

test('qualification requires multiple speakers and reports reading-base groups',()=>{
 const {verify,qualify}=api(),f=fixture(),r=verify(f.manifest,f.capture,f.policy);
 assert.equal(r.byBase.ge.tone.total,4);
 assert.equal(qualify(r,{minPositives:5,minControls:1}).passed,false);
 assert.throws(()=>qualify(r,{minCoverage:-1}),/gate|threshold/i);
});

test('entirely unmeasured critical comparisons cannot qualify a method',()=>{
 const {verify,qualify}=api(),f=fixture();
 f.manifest.criticalContrasts=[['ge1','ke1']];
 for(const p of f.capture.predictions){
  const reading=f.manifest.clips.find(c=>c.id===p.clipId).pinyin;
  if(['ge1','ke1'].includes(reading))p.scores={};
 }
 const report=verify(f.manifest,f.capture,f.policy);
 assert.equal(report.critical.rejected,0);assert.equal(report.critical.abstained,2);
 assert.equal(qualify(report,{minPositives:5,minControls:1,minSpeakers:1}).passed,false);
 assert.equal(report.criticalCoverage.measuredPairs,0);
 assert.equal(report.criticalCoverage.decisionCoverage,0);
});

test('whole-reading acceptance excludes partial abstentions while retaining a known rejection',()=>{
 const {verify}=api(),f=fixture();
 f.capture.predictions[0].scores.initial=structuredClone(f.capture.predictions[1].scores.initial);
 delete f.capture.predictions[0].scores.final;
 const r=verify(f.manifest,f.capture,f.policy);
 assert.equal(r.full.accepted,f.manifest.clips.length-1);
 assert.equal(r.full.abstained,1);assert.equal(r.disposition.mismatch,1);
 assert.equal(r.results[0].status,'abstained');
});

test('critical coverage distinguishes declared pairs, directed comparisons and unique clips',()=>{
 const {verify}=api(),f=fixture();f.manifest.criticalContrasts=[['ge1','ke1'],['ge2','ke2']];
 const r=verify(f.manifest,f.capture,f.policy);
 assert.equal(r.criticalCoverage.declaredPairs,2);assert.equal(r.criticalCoverage.representedPairs,1);
 assert.equal(r.criticalCoverage.distinctClips,2);assert.equal(r.criticalCoverage.directedPairs,2);
 assert.deepEqual(r.criticalCoverage.untestedPairs,[{pair:['ge2','ke2'],missingReadings:['ke2']}]);
});

test('final freeze binds exact reference scope, qualification settings and imported parser',t=>{
 const {verify,identity,qualify}=api(),f=fixture('held-out');
 const frozen=identity(f.capture,f.policy,{manifest:f.manifest});
 const report=verify(f.manifest,f.capture,f.policy,{frozen});
 assert.throws(()=>qualify(report,{minPositives:1,minControls:1,minSpeakers:1}),/frozen|gate/i);
 const tampered=structuredClone(report);tampered.qualificationConfig.minCoverage=.1;
 assert.throws(()=>qualify(tampered),/frozen|gate/i);
 const changed=structuredClone(f.manifest);changed.criticalContrasts.push(['ge1','ke1']);
 assert.throws(()=>verify(changed,f.capture,f.policy,{frozen}),/frozen/i);
 assert.throws(()=>verify(f.manifest,f.capture,f.policy,{frozen,qualification:{minCoverage:.1}}),/frozen/i);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'grove-frozen-parser-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 fs.copyFileSync(modulePath,path.join(temp,'audio-acceptance.cjs'));
 const parser=path.join(temp,'audio-natural-benchmark.cjs');
 fs.copyFileSync(path.join(__dirname,'../scripts/audio-natural-benchmark.cjs'),parser);
 const copy=require(path.join(temp,'audio-acceptance.cjs'));
 const before=copy.identity(f.capture,f.policy,{manifest:f.manifest});
 fs.appendFileSync(parser,'\n// changed parser source identity\n');
 assert.throws(()=>copy.verify(f.manifest,f.capture,f.policy,{frozen:before}),/frozen/i);
});
