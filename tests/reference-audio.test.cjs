const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const {numberedPinyin}=require('../scripts/audio-pilot.cjs');
const root=path.resolve(__dirname,'..');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');

test('published reference set covers every curriculum reading with verified source and output hashes',()=>{
 const manifestPath=path.join(root,'audio-sources/cns11643.json');
 assert.ok(fs.existsSync(manifestPath),'a source manifest must accompany the recordings');
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 const ctx=vm.createContext({});
 vm.runInContext(fs.readFileSync(path.join(root,'practice.js'),'utf8'),ctx);
 const all=require('../content/curriculum.js').cards;
 const expected=[...new Set(all.flatMap(c=>c.p.split(/\s*\/\s*/).map(p=>numberedPinyin(p).replaceAll('ü','v'))))].sort();
 assert.equal(expected.length,557);
 assert.deepEqual(Object.keys(manifest.readings).sort(),Array.from(expected));
 vm.runInContext(fs.readFileSync(path.join(root,'pronunciations.js'),'utf8'),ctx);
 const runtime=vm.runInContext('REFERENCE_AUDIO',ctx);
 assert.equal(runtime.source,'CNS11643');
 assert.deepEqual(Object.keys(runtime.readings).sort(),Array.from(expected));
 const hashes=new Map();
 for(const [key,row] of Object.entries(manifest.readings)) {
  assert.match(key,/^[a-z]+[1-5]$/);
  assert.equal(row.file,`audio/cns-${key}-${row.sha256.slice(0,12)}.${row.format}`);
  assert.ok(['mp3','wav'].includes(row.format));
  const audio=fs.readFileSync(path.join(root,row.file));
  assert.equal(audio.length,row.bytes,key);
  assert.equal(digest(audio),row.sha256,key);
  if(row.format==='mp3') assert.equal(row.source.sha256,row.sha256,key);
  else {
   assert.ok(key.endsWith('5'));
   assert.equal(row.conversion.sourceSha256,row.source.sha256);
   assert.equal(row.conversion.sampleRateHz,48000);
   assert.ok(row.conversion.maxAbsoluteQuantizationError<=1/32768);
  }
  assert.equal(runtime.readings[key],row.file,key);
  assert.match(row.bopomofo,/[ㄅ-ㄩ]/);
  assert.equal(hashes.has(row.sha256),false,`${key} shares bytes with ${hashes.get(row.sha256)}`);
  hashes.set(row.sha256,key);
 }
 assert.equal(digest(fs.readFileSync(path.join(root,manifest.source.mapping.file))),manifest.source.mapping.sha256);
});

test('u and ü repairs retain the independently labeled official recordings',()=>{
 const p=path.join(root,'audio-sources/cns11643.json');
 assert.ok(fs.existsSync(p),'the source manifest must record verified archive repairs');
 const m=JSON.parse(fs.readFileSync(p,'utf8'));
 assert.equal(m.readings.nu3.sha256,'1dfaa4683ed565732da0d052468bc959a0ec0eeeb2fc361cdfc3f8bdc0459d31');
 assert.equal(m.readings.lu4.sha256,'e1fe7d1a4acb154c5db3e511054c22b63ab61ae7fe73b97d7901c6c50f99d18d');
 assert.notEqual(m.readings.nu3.sha256,m.readings.nv3.sha256);
 assert.notEqual(m.readings.lu4.sha256,m.readings.lv4.sha256);
 assert.equal(m.readings.nu3.bopomofo,'ㄋㄨˇ');
 assert.equal(m.readings.nv3.bopomofo,'ㄋㄩˇ');
 assert.equal(m.readings.lu4.bopomofo,'ㄌㄨˋ');
 assert.equal(m.readings.lv4.bopomofo,'ㄌㄩˋ');
 assert.equal(m.readings.nu3.source.url,'https://www.cns11643.gov.tw/voice/male/M0598.mp3');
 assert.equal(m.readings.lu4.source.url,'https://www.cns11643.gov.tw/voice/male/M0724.mp3');
 for(const keys of [['mai3','mai4'],['jia3','jia4'],['shi1','shi2','shi3','shi4'],['yi1','yi2','yi3','yi4'],['e4','er4']])
  assert.equal(new Set(keys.map(k=>m.readings[k].sha256)).size,keys.length);
 const notice=fs.readFileSync(path.join(root,'audio-sources/LICENSE.txt'),'utf8');
 assert.match(notice,/數位發展部/); assert.match(notice,/20250113/); assert.match(notice,/https:\/\/data.gov.tw\/license/);
});
