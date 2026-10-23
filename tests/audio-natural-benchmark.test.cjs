const test=require('node:test'),assert=require('node:assert/strict');
const {phonemes,summarize}=require('../scripts/audio-natural-benchmark.cjs');
const sha='a'.repeat(64);
test('keeps real pronunciation contrasts and zero onsets separate',()=>{
 assert.deepEqual(phonemes('zhi3'),{initial:'zh',final:'iii',tone:'3'});
 assert.deepEqual(phonemes('zi3'),{initial:'z',final:'ii',tone:'3'});
 assert.deepEqual(phonemes('nv3'),{initial:'n',final:'v',tone:'3'});
 assert.deepEqual(phonemes('nü3'),phonemes('nv3'));
 assert.notDeepEqual(phonemes('nv3'),phonemes('nu3'));
 assert.deepEqual(phonemes('yi2'),{initial:'',final:'i',tone:'2'});
 assert.deepEqual(phonemes('ju4'),{initial:'j',final:'v',tone:'4'});
 assert.deepEqual(phonemes('liu2'),{initial:'l',final:'iou',tone:'2'});
 assert.equal(phonemes('zhi'),null);
 assert.equal(phonemes('nonsense3'),null);
});
const manifest={schemaVersion:1,id:'test',clips:[
 {id:'a',pinyin:'ma2',speaker:'A',split:'development',sha256:sha},
 {id:'b',pinyin:'ma1',speaker:'B',split:'held-out',sha256:sha},
 {id:'c',pinyin:'ke1',speaker:'B',split:'held-out',sha256:sha},
 {id:'d',pinyin:'ge1',speaker:'A',split:'development',sha256:sha}
]};
function capture(predictions){return{schemaVersion:1,models:[{id:'test-model',weightsSha256:sha,input:'audio-only',predictions}]}}
function p(clipId,reading){return{clipId,sha256:sha,components:reading?phonemes(reading):null,confidence:.99999}}
test('measures confident wrong tones and wrong consonants on real contrast families',()=>{
 const r=summarize(manifest,capture([p('a','ma1'),p('b','ma1'),p('c','ge1'),p('d','ge1')]));
 const m=r.models[0];
 assert.equal(m.positive.total,4);assert.equal(m.positive.matches,2);
 assert.equal(m.positive.components.tone.mismatch,1);
 assert.equal(m.positive.components.initial.mismatch,1);
 assert.equal(m.splits['held-out'].matches,1);
 assert.equal(m.controls.total,4);assert.equal(m.controls.falseAccepted,2);
 assert.equal(m.controls.byComponent.tone.falseAccepted,1);
 assert.equal(m.controls.byComponent.initial.falseAccepted,1);
 assert.equal(r.canPromote,false);
});
test('missing predictions and changed audio bytes abstain without shrinking denominators',()=>{
 const changed={...p('a','ma2'),sha256:'b'.repeat(64)};
 const m=summarize(manifest,capture([changed,p('b',null)])).models[0];
 assert.equal(m.positive.total,4);assert.equal(m.positive.matches,0);
 assert.equal(m.positive.uncertain,4);assert.equal(m.issues.length,3);
});
test('joint evidence abstains when the models disagree rather than voting through an error',()=>{
 const input=capture([p('a','ma1'),p('b','ma1'),p('c','ge1'),p('d','ge1')]);
 input.models.push({...input.models[0],id:'second-model',predictions:[p('a','ma2'),p('b','ma1'),p('c','ke1'),p('d','ge1')]});
 const r=summarize(manifest,input);
 assert.equal(r.joint.positive.matches,2);assert.equal(r.joint.positive.uncertain,2);
 assert.equal(r.joint.controls.falseAccepted,0);assert.equal(r.canPromote,false);
});
test('rejects duplicate results, changed reference splits, and text-conditioned model captures',()=>{
 assert.throws(()=>summarize(manifest,capture([p('a','ma2'),p('a','ma2')])),/Duplicate/);
 assert.throws(()=>summarize({...manifest,clips:[...manifest.clips,{...manifest.clips[0],id:'e',split:'held-out'}]},capture([])),/speaker/i);
 const input=capture([]);input.models[0].input='expected-pinyin';
 assert.throws(()=>summarize(manifest,input),/audio-only/);
});
test('includes zhi/zi near misses even though the apical vowel changes with the consonant',()=>{
 const m={...manifest,criticalContrasts:[['zhi3','zi3']],clips:[
  {...manifest.clips[0],pinyin:'zhi3'}, {...manifest.clips[1],pinyin:'zi3'}
 ]};
 const r=summarize(m,capture([p('a','zhi3'),p('b','zhi3')])).models[0];
 assert.equal(r.controls.total,2);assert.equal(r.controls.byComponent.combined.falseAccepted,1);
});
test('pinned natural captures retain failures and a genuinely separate speaker',()=>{
 const m=require('../data/audio-reference-benchmark.json'),c=require('../data/audio-reference-observations.json');
 const r=summarize(m,c);
 assert.equal(m.clips.length,87);
 assert.equal(r.models[1].splits['held-out'].total,29);
 assert.equal(r.models[1].splits['held-out'].matches,17);
 const failed=r.models[1].results.find(x=>x.pinyin==='zhi3'&&x.speaker==='M03');
 assert.equal(failed.components.tone,'mismatch');
 assert.equal(r.joint.positive.matches,33);
 assert.equal(r.joint.splits['held-out'].matches,8);
 assert.equal(r.joint.controls.falseAccepted,0);
 assert.deepEqual(m.design.missingReadings,['gou3']);
});
