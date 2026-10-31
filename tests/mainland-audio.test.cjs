const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
test('finite MSU release preserves exact keys, bytes, source flags and unfinished verification',()=>{
 const m=JSON.parse(fs.readFileSync('audio-sources/mainland.json')),keys=Object.keys(m.readings),curriculum=JSON.parse(fs.readFileSync('audio-sources/cns11643.json'));
 assert.equal(keys.length,548);assert.equal(m.verification.acceptanceBasis,'native-source-review');assert.equal(m.verification.methodQualified,false);assert.equal(m.verification.sourceReview.nativeReviewDocumented,true);
 assert.deepEqual(m.unsupported,['a5','ba5','de5','le5','ma5','me5','men5','ne5','zhe5']);const seen=new Set();
 for(const[k,r]of Object.entries(m.readings)){assert.ok(Object.hasOwn(curriculum.readings,k));assert.equal(sha(r.file),r.sha256);assert.equal(fs.statSync(r.file).size,r.bytes);assert.equal(r.sourceId,k+'_'+r.speaker);assert.equal(r.sourceMember,'tone_perfect/'+r.sourceId+'_MP3.mp3');assert.ok(!seen.has(r.sha256));seen.add(r.sha256);assert.equal(r.componentChecks.tone==='matches'||r.automaticCheckStatus==='pending',true);assert.equal(Object.values(r.componentChecks).includes('mismatch'),false);assert.equal(r.processing,'Unchanged original MP3 bytes');}
 assert.equal(keys.filter(k=>m.readings[k].automaticCheckStatus==='pending').length,27);for(const k of ['cuo4','she4','xing2','zuo3']){assert.equal(m.readings[k].originalSourceLexicalGap,true);assert.equal(m.readings[k].lexicalMetadataException.reading,k);}
 assert.equal(m.readings.gou1.speaker,'FV3','source-only fallback avoids the checker-disputed MV3 candidate');assert.notEqual(m.readings.jiao1.speaker,'FV3','publisher-deleted file is never fabricated');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('mainland-pronunciations.js','utf8'),ctx);const runtime=vm.runInContext('MAINLAND_AUDIO',ctx);assert.equal(JSON.stringify(runtime.readings),JSON.stringify(Object.fromEntries(keys.map(k=>[k,m.readings[k].file]))));assert.deepEqual(Array.from(runtime.pendingReadings),keys.filter(k=>m.readings[k].automaticCheckStatus==='pending'));
});
test('MSU catalog, disclosures and license ship together with explicit expected-catalog guard',()=>{
 const html=fs.readFileSync('index.html','utf8');assert.match(html,/data-mainland-recordings="true"/);assert.ok(html.indexOf('mainland-pronunciations.js')<html.indexOf('speech.js'));
 for(const file of ['mainland-pronunciations.js','audio-sources/mainland.json','audio-sources/LICENSE-MSU.txt','audio-sources/MSU-VERIFICATION.json'])for(const list of ['scripts/static-files.json','offline-assets.json'])assert.ok(JSON.parse(fs.readFileSync(list)).includes(file));
 const report=JSON.parse(fs.readFileSync('audio-sources/MSU-VERIFICATION.json'));assert.equal(report.automaticVerification.qualified,false);assert.equal(report.automaticVerification.finalReferenceTest.passed,false);assert.equal(report.coverage.sourceRecordings,548);
 assert.match(fs.readFileSync('audio-sources/LICENSE-MSU.txt','utf8'),/CC BY-NC 4.0/);assert.match(fs.readFileSync('audio-sources/LICENSE-MSU.txt','utf8'),/Tone Perfect MP3 Dataset/);
});
