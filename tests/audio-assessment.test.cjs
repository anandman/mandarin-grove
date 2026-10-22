// Transport/schema fixtures only. These tests do not measure Mandarin accuracy.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {assessClips,classifyAssessment}=require('../scripts/audio-assessment.cjs');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function responseFixture(){return {id:'req_fixture',locale:'zh-CN',model_version:'fixture-model',status:'completed',assessable:true,scores:{overall:99},words:[{word:'离',pinyin:'li2'}],syllables:[{index:0,expected:{pinyin:'li2',initial:'l',final:'i',tone:2},span_ms:[0,300],components:{initial:{expected:'l',heard:'l',score:99,confidence:'high',decision:'no_correction'},final:{expected:'i',heard:'i',score:99,confidence:'high',decision:'no_correction'},tone:{expected:2,heard:2,score:99,confidence:'high',decision:'no_correction'}}}],billing:{credits:1,source:'free',free_credits:49}};}
function sandbox(){const folder=fs.mkdtempSync(path.join(os.tmpdir(),'grove-assess-'));const file=path.join(folder,'audio.wav');const bytes=Buffer.alloc(100,1);bytes.write('RIFF');bytes.write('WAVE',8);fs.writeFileSync(file,bytes);return {folder,file,clip:{id:'clip-one',text:'离',pinyin:'lí',kind:'character',file,sha256:digest(bytes)}};}
const options={apiKey:'tp_live_unit_test_only',maxRequests:2};

test('isolated acoustic component evidence matches while transcript-only evidence remains uncertain',()=>{
 const classified=classifyAssessment(responseFixture(),{pinyin:'lí',kind:'character'});
 assert.equal(classified.status,'matches');assert.deepEqual(classified.components,{initial:'matches',final:'matches',tone:'matches'});assert.equal(classified.calibrated,false);assert.equal(classified.approved,undefined);
 const transcriptOnly=responseFixture();delete transcriptOnly.syllables;
 assert.equal(classifyAssessment(transcriptOnly,{pinyin:'li2',kind:'character'}).status,'uncertain');
});
test('heard labels, confidence, unknown decisions, reference identity and score all affect diagnostics',()=>{
 const context={pinyin:'li2',kind:'character'};
 const wrong=responseFixture();wrong.syllables[0].components.tone.heard=4;
 assert.equal(classifyAssessment(wrong,context).status,'mismatch');
 wrong.syllables[0].components.tone.confidence='low';assert.equal(classifyAssessment(wrong,context).status,'uncertain');
 for(const mutation of [r=>r.syllables[0].components.tone.decision='new_unknown_decision',r=>r.syllables[0].components.tone.agrees_with_prompt=false,r=>r.syllables[0].components.tone.score=40,r=>r.syllables[0].expected.pinyin='li4',r=>r.status='partial',r=>r.assessable=false,r=>r.test=true]){
  const result=responseFixture();mutation(result);assert.equal(classifyAssessment(result,context).status,'uncertain');
 }
 const low=responseFixture();low.syllables[0].components.tone.score=85;
 assert.equal(classifyAssessment(low,context).status,'uncertain');
 assert.equal(classifyAssessment(low,{...context,diagnosticMinScore:80}).status,'matches');
});
test('neutral tone and connected speech never become isolated matches',()=>{
 const neutral=responseFixture();neutral.syllables[0].expected={pinyin:'li5',initial:'l',final:'i',tone:5};neutral.syllables[0].components.tone={expected:5,heard:5,score:99,confidence:'high',decision:'no_correction'};
 assert.equal(classifyAssessment(neutral,{pinyin:'li5',kind:'character'}).status,'uncertain');
 assert.equal(classifyAssessment(responseFixture(),{pinyin:'li2',kind:'sentence'}).status,'uncertain');
});
test('all request budgets, references, and actual audio hashes are checked before network',async()=>{
 const s=sandbox();let reached=false;const fetchImpl=async()=>{reached=true;throw Error('network reached');};
 try{
  for(const maxRequests of [undefined,0,-1,1.5,NaN])await assert.rejects(assessClips([s.clip],s.folder,{...options,maxRequests,fetchImpl}),/budget/);
  await assert.rejects(assessClips([s.clip,{...s.clip,id:'second',text:'里',pinyin:'li3'}],s.folder,{...options,maxRequests:1,fetchImpl}),/budget/);
  await assert.rejects(assessClips([s.clip,{...s.clip,id:'second',pinyin:'!!!'}],s.folder,{...options,fetchImpl}),/pinyin/i);
  await assert.rejects(assessClips([{...s.clip,sha256:'0'.repeat(64)}],s.folder,{...options,fetchImpl}),/changed|digest|hash/i);
  await assert.rejects(assessClips([s.clip],s.folder,{...options,apiKey:'tp_test_fixture',fetchImpl}),/test key/i);
  assert.equal(reached,false);
 }finally{fs.rmSync(s.folder,{recursive:true,force:true});}
});
test('requests upload the snapshot bytes and checkpoints preserve exact evidence without secrets',async()=>{
 const s=sandbox();let calls=0,firstKey;
 const fetchImpl=async(url,request)=>{
  calls++;assert.equal(url,'https://api.toneperfect.app/v1/assess');assert.equal(request.method,'POST');assert.equal(request.headers.Authorization,'Bearer tp_live_unit_test_only');assert.equal(request.headers['TonePerfect-Response'],undefined);
  assert.equal(request.body.get('text'),null);assert.equal(request.body.get('pinyin'),'li2');assert.equal(request.body.get('task'),'isolated_word');assert.equal(request.body.get('language'),'zh-CN');
  assert.deepEqual(Buffer.from(await request.body.get('audio').arrayBuffer()),fs.readFileSync(s.file));firstKey=request.headers['Idempotency-Key'];
  return {ok:true,status:200,headers:{get:()=>null},json:async()=>responseFixture()};
 };
 try{
  const first=await assessClips([s.clip],s.folder,{...options,fetchImpl});assert.equal(first.requests,1);assert.equal(first.results[0].sha256,s.clip.sha256);assert.equal(first.results[0].provenance.transport,'injected-fetch');assert.equal(first.results[0].provenance.realProviderCall,false);
  const second=await assessClips([s.clip],s.folder,{...options,fetchImpl});assert.equal(second.requests,0);assert.equal(second.results[0].cached,true);assert.equal(calls,1);assert.equal(second.results[0].cacheKey,first.results[0].cacheKey);assert.ok(firstKey.includes(first.results[0].cacheKey));
  const checkpoint=fs.readFileSync(path.join(s.folder,'assessment-checkpoint.json'),'utf8');assert.ok(!checkpoint.includes(options.apiKey));assert.equal(JSON.parse(checkpoint).results[0].response.model_version,'fixture-model');
  fs.appendFileSync(s.file,'changed');await assert.rejects(assessClips([s.clip],s.folder,{...options,fetchImpl}),/changed|digest|hash/i);assert.equal(calls,1);
 }finally{fs.rmSync(s.folder,{recursive:true,force:true});}
});
test('partial failure keeps the first response cached and does not repeat its request',async()=>{
 const s=sandbox();const second={...s.clip,id:'second',text:'里',pinyin:'li3'};let calls=0;
 const fetchImpl=async()=>{calls++;if(calls===2)throw Error('unit-test network failure with secret '+options.apiKey);return {ok:true,status:200,headers:{get:()=>null},json:async()=>responseFixture()};};
 try{
  await assert.rejects(assessClips([s.clip,second],s.folder,{...options,fetchImpl}),error=>!/tp_live/.test(error.message));
  assert.equal(JSON.parse(fs.readFileSync(path.join(s.folder,'assessment-checkpoint.json'))).results.length,1);
  const resumed=await assessClips([s.clip,second],s.folder,{...options,maxRequests:1,fetchImpl});assert.equal(resumed.requests,1);assert.equal(resumed.results[0].cached,true);assert.equal(calls,3);
 }finally{fs.rmSync(s.folder,{recursive:true,force:true});}
});
test('test responses, timeout and HTTP errors stop without valid cache entries',async()=>{
 for(const mode of ['test-body','test-header','timeout','http']){
  const s=sandbox();let calls=0;
  const fetchImpl=async()=>{calls++;if(mode==='timeout')return new Promise(()=>{});return {ok:mode!=='http',status:503,headers:{get:name=>mode==='test-header'&&name==='X-TonePerfect-Test'?'true':null},json:async()=>({...responseFixture(),...(mode==='test-body'?{test:true}:{})})};};
  try{
   await assert.rejects(assessClips([s.clip],s.folder,{...options,timeoutMs:10,fetchImpl}),/test|timeout|HTTP/);
   assert.equal(calls,1);assert.ok(!fs.readdirSync(s.folder).some(name=>name.startsWith('toneperfect-')));
  }finally{fs.rmSync(s.folder,{recursive:true,force:true});}
 }
});
test('a missing component leaves the overall decision uncertain even alongside another mismatch',()=>{
 const response=responseFixture();response.syllables[0].components.tone.heard=4;delete response.syllables[0].components.final;
 const result=classifyAssessment(response,{pinyin:'li2',kind:'character'});
 assert.equal(result.status,'uncertain');assert.equal(result.components.tone,'mismatch');assert.equal(result.components.final,'uncertain');
});
test('cached responses are reclassified with the current diagnostic policy and cache corruption fails closed',async()=>{
 const s=sandbox();let calls=0;
 const fetchImpl=async()=>{calls++;const response=responseFixture();response.syllables[0].components.tone.score=85;return {ok:true,status:200,json:async()=>response};};
 try{
  assert.equal((await assessClips([s.clip],s.folder,{...options,fetchImpl})).results[0].assessment.status,'uncertain');
  assert.equal((await assessClips([s.clip],s.folder,{...options,fetchImpl,diagnosticMinScore:80})).results[0].assessment.status,'matches');assert.equal(calls,1);
  const file=path.join(s.folder,fs.readdirSync(s.folder).find(name=>name.startsWith('toneperfect-'))),saved=JSON.parse(fs.readFileSync(file));saved.response.model_version='tampered';fs.writeFileSync(file,JSON.stringify(saved));
  await assert.rejects(assessClips([s.clip],s.folder,{...options,fetchImpl}),/cache/);assert.equal(calls,1);
 }finally{fs.rmSync(s.folder,{recursive:true,force:true});}
});
test('all isolated clips use the same pinyin-only inference mode and changed references get distinct caches',async()=>{
 const s=sandbox();let calls=0;
 const fetchImpl=async(url,request)=>{calls++;assert.equal(request.body.get('text'),null);assert.equal(request.body.get('pinyin'),calls===1?'li2':'li3');assert.equal(request.body.get('task'),'isolated_word');return {ok:true,status:200,json:async()=>responseFixture()};};
 try{
  const candidate=await assessClips([s.clip],s.folder,{...options,fetchImpl});
  const identical=await assessClips([{...s.clip,role:'control'}],s.folder,{...options,fetchImpl});assert.equal(identical.requests,0);assert.equal(identical.results[0].cacheKey,candidate.results[0].cacheKey);
  const control=await assessClips([{...s.clip,role:'control',pinyin:'li3'}],s.folder,{...options,fetchImpl});
  assert.equal(control.requests,1);assert.notEqual(control.results[0].cacheKey,candidate.results[0].cacheKey);assert.equal(control.results[0].provenance.referenceMode,'pinyin-only');assert.equal(candidate.results[0].provenance.referenceMode,'pinyin-only');assert.equal(calls,2);
 }finally{fs.rmSync(s.folder,{recursive:true,force:true});}
});
test('uploads are sequential and changed bytes without a declared hash receive a new cache identity',async()=>{
 const s=sandbox();const second={...s.clip,id:'second',text:'里',pinyin:'li3'};let running=0,maxRunning=0,calls=0;
 const fetchImpl=async()=>{calls++;running++;maxRunning=Math.max(running,maxRunning);await new Promise(resolve=>setTimeout(resolve,5));running--;return {ok:true,status:200,json:async()=>responseFixture()};};
 try{
  const first=await assessClips([{...s.clip,sha256:undefined},second],s.folder,{...options,fetchImpl});assert.equal(maxRunning,1);
  fs.appendFileSync(s.file,'new snapshot');const changed=await assessClips([{...s.clip,sha256:undefined}],s.folder,{...options,fetchImpl});assert.equal(changed.requests,1);assert.notEqual(changed.results[0].sha256,first.results[0].sha256);assert.notEqual(changed.results[0].cacheKey,first.results[0].cacheKey);assert.equal(calls,3);
 }finally{fs.rmSync(s.folder,{recursive:true,force:true});}
});
function componentFixture(pinyin,initial,final){
 const response=responseFixture(),tone=Number(pinyin.slice(-1));response.syllables[0].expected={pinyin,initial,final,tone};
 for(const [dimension,value] of Object.entries({initial,final,tone}))response.syllables[0].components[dimension]={expected:value,heard:value,score:99,confidence:'high',decision:'no_correction'};
 return response;
}
test('provider expected components must independently reconstruct the supplied pinyin',()=>{
 for(const [pinyin,initial,final] of [['li2','b','a'],['nü3','n','u'],['lü4','n','ü'],['zhi3','zh','ii'],['li2','l','xyz'],['ja1','j','a']]){
  assert.equal(classifyAssessment(componentFixture(pinyin,initial,final),{pinyin,kind:'character'}).status,'uncertain',`${pinyin}: ${initial}+${final}`);
 }
});
test('standard spelling aliases preserve y/w, ü, contracted finals and apical-vowel identity',()=>{
 for(const [pinyin,initial,final] of [['lü4','l','v'],['nü3','n','ü'],['zhi3','zh','i'],['zhi3','zh','iii'],['zi3','z','ii'],['juan3','j','üan'],['juan3','j','uan'],['qun2','q','ün'],['xue2','x','üe'],['gui1','g','uei'],['liu2','l','iou'],['lun4','l','uen'],['yue4','y','üe'],['yue4','y','ue'],['yue4','','üe'],['you3','y','ou'],['you3','','iou'],['yi1','y','i'],['yi1','','i'],['wei4','w','ei'],['wei4','','uei'],['wu3','w','u'],['wu3','','u']]){
  assert.equal(classifyAssessment(componentFixture(pinyin,initial,final),{pinyin,kind:'character'}).status,'matches',`${pinyin}: ${initial}+${final}`);
 }
});
test('alias normalization never merges ü with u, g with k, or the two apical-vowel categories',()=>{
 const frontRounded=componentFixture('nü3','n','ü');frontRounded.syllables[0].components.final.heard='u';
 assert.equal(classifyAssessment(frontRounded,{pinyin:'nü3',kind:'character'}).components.final,'mismatch');
 const aspiration=componentFixture('gou3','g','ou');aspiration.syllables[0].components.initial.heard='k';
 assert.equal(classifyAssessment(aspiration,{pinyin:'gou3',kind:'character'}).components.initial,'mismatch');
 const apical=componentFixture('zhi3','zh','iii');apical.syllables[0].components.final.heard='ii';
 assert.equal(classifyAssessment(apical,{pinyin:'zhi3',kind:'character'}).status,'uncertain');
 const alias=componentFixture('lü4','l','ü');alias.syllables[0].components.final.heard='v';
 assert.equal(classifyAssessment(alias,{pinyin:'lü4',kind:'character'}).components.final,'matches');
});
function zeroOnsetFixture(){
 const response=componentFixture('yi3','y','i');response.syllables[0].expected.initial=null;
 // Shape observed in the live provider response, with no expected/heard initial keys.
 response.syllables[0].components.initial={applicable:false,note:'This syllable has no initial consonant.',acceptance_probability:null,score:null,decision:'unassessable',advice:null};
 return response;
}
test('an explicitly inapplicable zero onset leaves valid final and tone evidence measurable',()=>{
 const result=classifyAssessment(zeroOnsetFixture(),{pinyin:'yi3',kind:'character'});
 assert.equal(result.status,'matches');assert.deepEqual(result.components,{initial:'not-applicable',final:'matches',tone:'matches'});
 const onset=result.syllables[0].components.initial;assert.equal(onset.applicable,false);assert.equal(onset.score,null);assert.equal(onset.confidence,null);assert.ok(onset.reasons.some(r=>/no initial|not measured/i.test(r)));
 const medium=zeroOnsetFixture();medium.syllables[0].components.tone.confidence='medium';medium.syllables[0].components.tone.score=77;
 const uncertain=classifyAssessment(medium,{pinyin:'yi3',kind:'character'});assert.equal(uncertain.status,'uncertain');assert.equal(uncertain.components.final,'matches');assert.equal(uncertain.components.tone,'uncertain');
});
test('an unmeasured initial cannot excuse consonant targets or contradictory zero-onset evidence',()=>{
 const consonant=zeroOnsetFixture();consonant.syllables[0].expected.pinyin='li3';
 assert.equal(classifyAssessment(consonant,{pinyin:'li3',kind:'character'}).status,'uncertain');
 for(const mutation of [r=>delete r.syllables[0].components.initial.applicable,r=>r.syllables[0].components.initial.applicable=true,r=>r.syllables[0].components.initial.heard='l',r=>r.syllables[0].components.initial.expected='l',r=>r.syllables[0].components.initial.score=99,r=>r.syllables[0].components.initial.decision='unknown']){
  const response=zeroOnsetFixture();mutation(response);assert.equal(classifyAssessment(response,{pinyin:'yi3',kind:'character'}).status,'uncertain');
 }
});
