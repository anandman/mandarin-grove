const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createBundledAudit,createGeneratedAudit,withToneControls,summarizeAudit}=require('../scripts/audio-audit.cjs');
const {ENDPOINT,PROTOCOL}=require('../scripts/audio-assessment.cjs');
const setup=()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'grove-audit-'));for(const ch of ['狗','女','假'])fs.writeFileSync(path.join(dir,ch+'.mp3'),'test audio '+ch);return dir};
const dataset={version:1,cases:[{id:'dog',kind:'character',text:'狗',pinyin:'gǒu'},{id:'female',kind:'character',text:'女',pinyin:'nǚ'},{id:'holiday',kind:'character',text:'假',pinyin:'jià'},{id:'false',kind:'character',text:'假',pinyin:'jiǎ'},{id:'paper',kind:'character',text:'纸',pinyin:'zhǐ'}]};
test('bundled audit retains separate polyphonic targets, missing files and exact bytes; controls change one component',()=>{
 const dir=setup();try{const plan=createBundledAudit(dataset,{audioDir:dir,characters:['狗','女','假','纸']});
 const candidates=plan.clips.filter(c=>c.role==='candidate');assert.equal(candidates.length,5);
 const alternate=candidates.filter(c=>c.text==='假');assert.notEqual(alternate[0].id,alternate[1].id);assert.equal(alternate[0].sha256,alternate[1].sha256);
 assert.equal(candidates.find(c=>c.text==='纸').availability,'missing');
 const dog=candidates.find(c=>c.text==='狗'),female=candidates.find(c=>c.text==='女');
 for(const c of plan.clips.filter(c=>c.control?.sourceId===dog.id)){assert.equal(c.file,dog.file);assert.equal(c.sha256,dog.sha256);assert.notEqual(c.pinyin,dog.pinyin)}
 assert.ok(plan.clips.some(c=>c.control?.sourceId===dog.id&&c.control.component==='initial'&&c.pinyin==='kou3'));
 assert.ok(plan.clips.some(c=>c.control?.sourceId===female.id&&c.control.component==='final'&&c.pinyin==='nu3'));
 assert.equal(plan.id,createBundledAudit(dataset,{audioDir:dir,characters:['狗','女','假','纸']}).id);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('generation audit refuses changed bytes and never substitutes a character file for a different reading',()=>{
 const dir=setup();try{const bundled=createBundledAudit(dataset,{audioDir:dir,characters:['假']}),c=bundled.clips.find(c=>c.role==='candidate');
 const generated={id:'plan',clips:[{id:'holiday',kind:'character',text:'假',pinyin:'jià',file:'假.mp3',sha256:c.sha256}]};
 assert.equal(createGeneratedAudit(generated,{audioDir:dir}).clips[0].availability,'available');
 fs.writeFileSync(path.join(dir,'假.mp3'),'changed');assert.equal(createGeneratedAudit(generated,{audioDir:dir}).clips[0].availability,'changed');
 assert.throws(()=>createGeneratedAudit({...generated,clips:[{...generated.clips[0],file:'../outside.mp3'}]},{audioDir:dir}),/file/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
// Schema fixtures simulate native transport solely to test the report gates; no API calls occur.
function evidence(plan){
 const parts=p=>{const [,initial,final,tone]=/^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw]?)([a-zü]+)([1-5])$/.exec(p);return{pinyin:p,initial,final,tone:Number(tone)}};
 return{provider:'TonePerfect',protocol:PROTOCOL,results:plan.clips.filter(c=>c.availability==='available').map(c=>{
  const expected=parts(c.pinyin),heard=parts(c.role==='control'?plan.clips.find(s=>s.id===c.control.sourceId).pinyin:c.pinyin);
  return{clipId:c.id,sha256:c.sha256,provenance:{endpoint:ENDPOINT,protocol:PROTOCOL,transport:'native-fetch',realProviderCall:true,modelVersion:'unit-test-fixture',referenceMode:'pinyin-only',retrievedAt:'2026-10-22T01:00:00Z'},response:{model_version:'unit-test-fixture',status:'completed',assessable:true,syllables:[{index:0,expected,span_ms:[0,300],components:Object.fromEntries(['initial','final','tone'].map(k=>[k,{expected:expected[k],heard:heard[k],score:99,confidence:'high',decision:expected[k]===heard[k]?'no_correction':'review'}]))}]}};
 })};
}
test('contradictory-reading controls must fail in the tested component; matches never become promotion approval',()=>{
 const dir=setup();try{const plan=createBundledAudit(dataset,{audioDir:dir,characters:['狗']}),raw=evidence(plan);
 let report=summarizeAudit(plan,raw);assert.equal(report.candidates[0].status,'candidate-matches');assert.equal(report.canPromote,false);assert.equal(report.controls.failed,0);
 const control=plan.clips.find(c=>c.control?.component==='tone');raw.results.find(r=>r.clipId===control.id).response.syllables[0].components.tone={expected:4,heard:4,score:99,confidence:'high',decision:'no_correction'};
 report=summarizeAudit(plan,raw);assert.equal(report.candidates[0].status,'uncertain');assert.equal(report.controls.failed,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('missing, stale and incomplete assessment evidence cannot pass; changed current bytes invalidate earlier evidence',()=>{
 const dir=setup();try{const plan=createBundledAudit(dataset,{audioDir:dir,characters:['狗','纸']}),raw=evidence(plan),dog=plan.clips.find(c=>c.role==='candidate'&&c.text==='狗');
 assert.equal(summarizeAudit(plan,{results:[]}).candidates.find(c=>c.id===dog.id).status,'uncertain');
 raw.results.find(r=>r.clipId===dog.id).sha256='old';assert.equal(summarizeAudit(plan,raw).candidates.find(c=>c.id===dog.id).status,'stale');
 raw.results.find(r=>r.clipId===dog.id).sha256=dog.sha256;fs.writeFileSync(dog.file,'changed');
 assert.equal(summarizeAudit(plan,raw).candidates.find(c=>c.id===dog.id).status,'stale');
 assert.equal(summarizeAudit(plan,raw).candidates.find(c=>c.text==='纸').status,'missing');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('transcript-like agreement without component evidence is inconclusive',()=>{
 const dir=setup();try{const plan=createBundledAudit(dataset,{audioDir:dir,characters:['狗']}),raw=evidence(plan),c=raw.results.find(r=>r.clipId===plan.clips[0].id);c.response={status:'completed',assessable:true,text:'狗',model_version:'unit-test-fixture'};
 assert.equal(summarizeAudit(plan,raw).candidates[0].status,'uncertain');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('fixture transports and incompatible model versions never establish candidate agreement',()=>{
 const dir=setup();try{const plan=createBundledAudit(dataset,{audioDir:dir,characters:['狗']}),raw=evidence(plan);
 for(const r of raw.results){r.provenance.realProviderCall=false;r.provenance.transport='injected-fetch'}
 assert.equal(summarizeAudit(plan,raw).candidates[0].status,'uncertain');
 const incompatible=evidence(plan),control=incompatible.results[1];control.provenance.modelVersion='different';control.response.model_version='different';
 assert.equal(summarizeAudit(plan,incompatible).candidates[0].status,'uncertain');
 const testResponse=evidence(plan);testResponse.results[0].response.test=true;
 assert.equal(summarizeAudit(plan,testResponse).candidates[0].status,'uncertain');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('physical controls retain their intervention evidence, require exact bytes, and cannot pass on missing tone measurements',()=>{
 const dir=setup();try{
  const plan=createBundledAudit(dataset,{audioDir:dir,characters:['狗']}),source=plan.clips[0];
  const profiles=[[200,200,200,200,200],[100,125,150,175,200],[170,130,110,150,200],[250,220,180,150,120]];
  const physical={schemaVersion:1,method:'praat-pitch-tier-overlap-add-v1',clips:Array.from({length:8},(_,i)=>{
   const file=path.join(dir,'physical-'+i+'.wav');fs.writeFileSync(file,'unit-test waveform fixture '+i);
   const sha256=require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');
   return{...source,id:'physical-'+i,file,sha256,expectedSha256:sha256,role:'calibration',pinyin:'gou'+(i%4+1),calibration:{method:'praat-pitch-tier-overlap-add-v1',nativeCorrectnessVerified:false,sourceSha256:(i<4?'a':'b').repeat(64),measuredAudioSha256:sha256,imposedTone:i%4+1,measuredF0Hz:profiles[i%4]}};
  })};
  const merged=withToneControls(plan,physical);assert.notEqual(merged.id,plan.id);assert.equal(merged.clips.filter(c=>c.role==='calibration').length,8);
  assert.equal(summarizeAudit(merged,evidence(plan)).judgeCalibration.status,'failed-or-inconclusive');
  assert.equal(summarizeAudit(merged,evidence(merged)).judgeCalibration.status,'passed');
  const twoModels=withToneControls(createBundledAudit(dataset,{audioDir:dir,characters:['狗','女']}),physical),raw=evidence(twoModels);
  for(const r of raw.results){if(twoModels.clips.find(c=>c.id===r.clipId).text==='女'){r.response.model_version='another-fixture';r.provenance.modelVersion='another-fixture'}}
  assert.equal(summarizeAudit(twoModels,raw).judgeCalibration.status,'failed-or-inconclusive');
  const bad=structuredClone(physical);bad.clips[0].sha256='0'.repeat(64);bad.clips[0].calibration.measuredAudioSha256=bad.clips[0].sha256;assert.throws(()=>withToneControls(plan,bad),/bytes/);
  const duplicate=structuredClone(physical);duplicate.clips[1].sha256=duplicate.clips[0].sha256;duplicate.clips[1].file=duplicate.clips[0].file;duplicate.clips[1].calibration.measuredAudioSha256=duplicate.clips[0].sha256;assert.throws(()=>withToneControls(plan,duplicate),/distinct/);
  const wrongShape=structuredClone(physical);wrongShape.clips[1].calibration.measuredF0Hz=[200,200,200,200,200];assert.throws(()=>withToneControls(plan,wrongShape),/contour/);
  delete physical.clips[0].calibration.measuredF0Hz;assert.throws(()=>withToneControls(plan,physical),/control/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('valid zero onset stays not-applicable while measured final and tone can establish diagnostic agreement',()=>{
 const dir=setup();try{
  fs.writeFileSync(path.join(dir,'衣.mp3'),'zero-onset unit fixture');
  const plan=createBundledAudit({version:1,cases:[{id:'yi',kind:'character',text:'衣',pinyin:'yī'}]},{audioDir:dir,characters:['衣']}),raw=evidence(plan);
  for(const result of raw.results){const syllable=result.response.syllables[0];syllable.expected.initial=null;syllable.components.initial={applicable:false,score:null,decision:'unassessable'};}
  const report=summarizeAudit(plan,raw);
  assert.equal(report.candidates[0].components.initial,'not-applicable');
  assert.equal(report.candidates[0].status,'candidate-matches');
  assert.equal(report.canPromote,false);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
