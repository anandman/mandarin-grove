const test=require('node:test'),assert=require('node:assert/strict');
const {numberedPinyin,createAudioPlan,reviewedClips}=require('../scripts/audio-pilot.cjs');
const sample={version:1,cases:[{id:'green',kind:'character',text:'绿',pinyin:'lǜ',meaning:'green',readingReview:'pending'},{id:'sentence',kind:'sentence',text:'你好。',pinyin:'nǐ hǎo',meaning:'Hello.',readingReview:'pending'}]};
test('audio requests retain ü and tones; connected speech is evaluated without forced syllables',()=>{
 assert.equal(numberedPinyin('lǜ nǚ ma lüè'),'lü4 nü3 ma5 lüe4');
 assert.equal(numberedPinyin('LǙ'.normalize('NFD')),'lü3');
 assert.throws(()=>numberedPinyin('hello!'));
 const plan=createAudioPlan(sample,['cmn-CN-Wavenet-A']);
 assert.match(plan.clips[0].request.input.ssml,/ph="lü4"/);
 assert.equal(plan.clips[1].request.input.text,'你好。');
 assert.ok(plan.totalCharacters>2);assert.equal(plan.clips[0].review.status,'pending');
 assert.equal(createAudioPlan(sample,['cmn-CN-Wavenet-A']).id,plan.id);
 assert.notEqual(createAudioPlan(sample,['cmn-CN-Wavenet-B']).id,plan.id);
});
test('invalid readings and duplicate case IDs cannot silently make a generation plan',()=>{
 assert.throws(()=>createAudioPlan({...sample,cases:[sample.cases[0],sample.cases[0]]}));
 assert.throws(()=>createAudioPlan({...sample,cases:[{...sample.cases[0],text:'绿色'}]}));
 assert.throws(()=>createAudioPlan(sample,['unknown-voice']));
});
test('only human-approved clips bound to the exact audio digest can be promoted',()=>{
 const plan=createAudioPlan(sample,['cmn-CN-Wavenet-A']);
 plan.clips[0].sha256='abc';plan.clips[1].sha256='def';
 const report={planId:plan.id,judgements:{[plan.clips[0].id]:{status:'approved',sha256:'abc'},[plan.clips[1].id]:{status:'unsure',sha256:'def'}}};
 assert.equal(reviewedClips(plan,report).length,1);
 assert.equal(reviewedClips(plan,{...report,judgements:{[plan.clips[0].id]:{status:'approved',sha256:'old'}}}).length,0);
 assert.throws(()=>reviewedClips(plan,{...report,planId:'another-batch'}));
});
test('the pilot covers reported contrasts and marks every reading as awaiting fluent review',()=>{
 const dataset=require('../data/speech-pilot.json');
 assert.equal(new Set(dataset.cases.filter(c=>c.kind==='character').map(c=>c.text)).size,40);
 assert.equal(dataset.cases.filter(c=>c.kind==='sentence').length,15);
 for(const text of ['止','离','满','狗','口','假','子','祖','组','女','绿'])assert.ok(dataset.cases.some(c=>c.text===text));
 assert.ok(dataset.cases.every(c=>c.readingReview==='pending'));
 const plan=createAudioPlan(dataset);assert.equal(plan.clips.length,134);assert.ok(plan.totalCharacters<20000);
});
test('generation enforces the actual request budget before any network call',async()=>{
 const {synthesizePlan}=require('../scripts/audio-pilot.cjs');
 const plan=createAudioPlan(sample,['cmn-CN-Wavenet-A']);plan.totalCharacters=0;
 await assert.rejects(synthesizePlan(plan,'/tmp/unused-audio',{apiKey:'test-only',maxCharacters:1,fetchImpl:()=>{throw Error('Network was reached')}}),/budget/);
});
test('generation checkpoints exact bytes and resumes without repeating paid requests',async()=>{
 const {synthesizePlan}=require('../scripts/audio-pilot.cjs'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'grove-audio-test-')),plan=createAudioPlan(sample,['cmn-CN-Wavenet-A']),bytes=Buffer.alloc(64,1);let requests=0;
 const options={apiKey:'test-only',fetchImpl:async(url,request)=>{requests++;assert.equal(url,'https://texttospeech.googleapis.com/v1/text:synthesize');assert.equal(request.headers['X-Goog-Api-Key'],'test-only');assert.deepEqual(JSON.parse(request.body),plan.clips[requests-1].request);return{ok:true,json:async()=>({audioContent:bytes.toString('base64')})}}};
 try{await synthesizePlan(plan,folder,options);assert.equal(requests,2);assert.deepEqual(fs.readFileSync(path.join(folder,plan.clips[0].file)),bytes);const saved=JSON.parse(fs.readFileSync(path.join(folder,'plan.json')));assert.ok(saved.clips.every(c=>c.sha256));await synthesizePlan(saved,folder,options);assert.equal(requests,2);}finally{fs.rmSync(folder,{recursive:true,force:true})}
});
test('audio cache identity follows spoken content and synthesis settings, not reviewer notes',()=>{
 const original=createAudioPlan(sample,['cmn-CN-Wavenet-A']);
 const annotated=createAudioPlan({...sample,cases:sample.cases.map(c=>({...c,notes:'Check carefully',readingReview:'confirmed'}))},['cmn-CN-Wavenet-A']);
 assert.equal(annotated.clips[0].id,original.clips[0].id);
 const changed=createAudioPlan({...sample,cases:[{...sample.cases[0],pinyin:'lǔ'}]},['cmn-CN-Wavenet-A']);assert.notEqual(changed.clips[0].id,original.clips[0].id);
});
