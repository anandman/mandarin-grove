const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const api=()=>require('../scripts/build-curriculum.cjs');

test('builder preserves taught alternatives while distinguishing direct, note and missing source evidence',()=>{
 assert.ok(fs.existsSync(path.join(ROOT,'scripts/build-curriculum.cjs')),'the independent curriculum builder exists');
 const dictionary=api().parseCedict('女 女 [nu:3] /female/woman/\n努 努 [nu3] /to exert/to strive/\n了 了 [le5] /completed-action particle/\n了 了 [liao3] /to finish/to understand/\n血 血 [xue4] /blood/colloquial pr. [xie3] or [xue3]/');
 const compatibility=[{character:'女',pinyin:'nǚ'},{character:'努',pinyin:'nǔ / nù'},{character:'了',pinyin:'le / liǎo'},{character:'血',pinyin:'xiě'}];
 const data=api().buildCurriculum({units:{K:[[2,'女努了血']]},compatibility,dictionary,supplements:[],source:{id:'fixture-dictionary'}});
 const byChar=new Map(data.cards.map(card=>[card.c,card]));
 assert.equal(byChar.get('女').p,'nǚ');
 assert.equal(byChar.get('女').readings[0].key,'nv3');
 assert.equal(byChar.get('努').readings[0].key,'nu3');
 assert.equal(byChar.get('努').p,'nǔ / nù');
 assert.equal(byChar.get('努').readings[1].evidence.kind,'unsupported');
 assert.equal(byChar.get('血').p,'xiě');
 assert.equal(byChar.get('血').readings[0].evidence.kind,'pronunciation-note');
 assert.equal(byChar.get('血').m,'blood');
 assert.deepEqual(byChar.get('了').readings.map(r=>r.evidence.kind),['headword','headword']);
 assert.deepEqual(data.review.unsupportedReadings,[{character:'努',pinyin:'nù'}]);
 assert.ok(data.cards.every(card=>card.w===''&&card.wp===''));
});

test('published curriculum derives membership/defaults and fresh definitions without inherited examples',()=>{
 assert.ok(fs.existsSync(path.join(ROOT,'content/curriculum.json')),'the independently sourced curriculum exists');
 const data=read('content/curriculum.json'),fixture=read('tests/fixtures/better-immersion-k5.json');
 const compatibility=read('content/reading-compatibility.json');
 const byChar=new Map(data.cards.map(card=>[card.c,card]));
 assert.equal(data.cards.length,841);
 assert.equal(byChar.size,841);
 assert.deepEqual(data.units,fixture);
 for(const grade of ['1','2','3','4','5'])assert.equal(data.grades[grade],fixture[grade].map(([,text])=>text).join(''));
 assert.equal(data.grades.K,fixture.K.map(([,text])=>text).join('')+'雨牙鱼牛羊车爱朋友');
 assert.equal(data.defaultCharacters.join(''),fixture['2'].slice(0,6).map(([,text])=>text).join(''));
 assert.equal(data.defaultCharacters.length,30);
 assert.equal(byChar.get('羊').g,'K');assert.equal(byChar.get('鱼').g,'K');
 assert.equal(byChar.get('牛').g,'K2');
 assert.equal(data.review.directHeadwordReadings,852);
 assert.equal(data.review.pronunciationNoteReadings,1);
 assert.deepEqual(data.review.unsupportedReadings,[]);
 for(const item of compatibility.readings){
  const card=byChar.get(item.character);assert.equal(card.p,item.pinyin,item.character);
  assert.equal(card.id,card.c);assert.ok(card.m.length>0,card.c);
  assert.equal(card.w,'');assert.equal(card.wp,'');
  assert.equal(card.source.review,'dictionary-derived-unreviewed');
  assert.ok(card.readings.every(reading=>reading.evidence.line&&reading.source===data.sources.lexical.id));
 }
 assert.equal(data.sources.lexical.license,'CC-BY-SA-4.0');
 assert.equal(data.sources.curriculum.redistribution,'publication-permission-unresolved');
 assert.equal(data.cards.find(card=>card.c==='狗').o,1);
 assert.equal(data.cards.find(card=>card.c==='一').o,0);
});

test('the pinned single-character evidence deterministically rebuilds the committed pack',()=>{
 assert.ok(fs.existsSync(path.join(ROOT,'scripts/build-curriculum.cjs')),'the independent curriculum builder exists');
 const source=read('vendor/cc-cedict/CHARACTERS-SOURCE.json');
 const bytes=fs.readFileSync(path.join(ROOT,source.subset.path));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),source.subset.sha256);
 const generated=api().buildCurriculum({units:read('tests/fixtures/better-immersion-k5.json'),compatibility:read('content/reading-compatibility.json').readings,dictionary:api().parseCedict(bytes.toString('utf8')),source});
 assert.deepEqual(generated,read('content/curriculum.json'));
 for(const card of generated.cards)for(const reading of card.readings){
  assert.ok(bytes.toString('utf8').split('\n').includes(reading.evidence.line));
 }
});

test('browser and CommonJS packs expose the same synchronous data without application startup',()=>{
 assert.ok(fs.existsSync(path.join(ROOT,'content/curriculum.js')),'the synchronous browser pack exists');
 const vm=require('node:vm'),context=vm.createContext({});
 vm.runInContext(fs.readFileSync(path.join(ROOT,'content/curriculum.js'),'utf8'),context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.GroveCurriculum)),read('content/curriculum.json'));
 assert.deepEqual(require('../content/curriculum.js'),read('content/curriculum.json'));
});


test('same-reading simplified mergers retain sourced senses and prefer substantive definitions to redirects',()=>{
 const dictionary=api().parseCedict('后 后 [hou4] /empress/queen/\n後 后 [hou4] /after/behind/\n干 干 [gan1] /old variant of 乾|干[gan1]/\n乾 干 [gan1] /dry/clean/');
 const data=api().buildCurriculum({units:{K:[[2,'后干']]},compatibility:[{character:'后',pinyin:'hòu'},{character:'干',pinyin:'gān'}],dictionary,supplements:[],source:{id:'fixture'}});
 assert.match(data.cards.find(row=>row.c==='后').m,/after/);
 assert.match(data.cards.find(row=>row.c==='后').m,/empress/);
 assert.equal(data.cards.find(row=>row.c==='后').readings[0].evidence.lines.length,2);
 assert.equal(data.cards.find(row=>row.c==='干').m,'dry; clean');
});
