const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('words.js','utf8'),ctx);if(fs.existsSync('help.js'))vm.runInContext(fs.readFileSync('help.js','utf8'),ctx);
const cards=[{c:'学',p:'xué',m:'to learn',g:'1',w:'学校',wp:'xuéxiào'},{c:'校',p:'xiào',m:'school',g:'1'},{c:'女',p:'nǚ',m:'girl, female',g:'K'},{c:'绿',p:'lǜ',m:'green',g:'3'},{c:'路',p:'lù',m:'road',g:'2'},{c:'止',p:'zhǐ',m:'stop',g:'4'}];
const bank={aliases:{学:['學'],绿:['綠']},entries:[['他们','他們','ta1 men5','they'],['妈妈','媽媽','ma1 ma5','mother'],['学校','學校','xue2 xiao4','school'],['学生','學生','xue2 sheng1','student'],['学会','學會','xue2 hui4','to learn; to master'],['女儿','女兒','nu:3 er2','daughter'],['绿色','綠色','lu:4 se4','green'],['还好','還好','hai2 hao3','fortunately'],['还好','還好','huan2 hao3','test alternative reading']]};
const plain=x=>JSON.parse(JSON.stringify(x));
function engine(){assert.equal(typeof ctx.createHelpLookup,'function','Local homework lookup is available');return ctx.createHelpLookup(cards,ctx.createWordIndex(bank),['学校','学生','女儿']);}
test('lookup searches the whole curriculum and dictionary using meanings, Chinese and traditional aliases',()=>{
 const e=engine();assert.equal(ctx.searchHelpLookup(e,'stop').items[0].text,'止');assert.equal(ctx.searchHelpLookup(e,'school').items[0].text,'校');
 assert.equal(ctx.searchHelpLookup(e,'學').items[0].text,'学');assert.equal(ctx.searchHelpLookup(e,'學校').items[0].text,'学校');
 assert.equal(ctx.searchHelpLookup(e,'学校').items[0].readings[0].meaning,'school');
});
test('marked/numbered pinyin, joined syllables and partial tone hints match without collapsing ü into u',()=>{
 const e=engine();assert.equal(ctx.searchHelpLookup(e,'nu: er2').items[0]?.text,'女儿');for(const q of ['nǚ','nv3','nu:3','nu:'])assert.equal(ctx.searchHelpLookup(e,q).items[0].text,'女');
 for(const q of ['lǜ','lv4','lu:4'])assert.equal(ctx.searchHelpLookup(e,q).items[0].text,'绿');
 assert.ok(!ctx.searchHelpLookup(e,'lu4').items.some(r=>r.text==='绿'));assert.equal(ctx.searchHelpLookup(e,'lu4').items[0].text,'路');
 for(const q of ['xuéxiào','xue2xiao4','xue xiào','xue2 xiao4'])assert.equal(ctx.searchHelpLookup(e,q).items[0].text,'学校');
 assert.ok(!ctx.searchHelpLookup(e,'xue4').items.some(r=>r.text==='学'));
 for(const q of ['tāmen5','ta1men5','tā men5'])assert.equal(ctx.searchHelpLookup(e,q).items[0]?.text,'他们');
 assert.equal(ctx.searchHelpLookup(e,'māma5').items[0]?.text,'妈妈');
});
test('alternate word readings share a result instead of silently losing the second reading',()=>{
 const r=ctx.searchHelpLookup(engine(),'还好').items[0];assert.equal(r.readings.length,2);assert.deepEqual(plain(r.readings.map(r=>r.pinyin)),['hái hǎo','huán hǎo']);
});
test('examples use existing curriculum/prompt vocabulary and practice selection contains only known, unique characters',()=>{
 const e=engine();assert.deepEqual(plain(ctx.helpLookupExamples(e,'学').map(r=>r.text)),['学校','学生']);
 assert.deepEqual(plain(ctx.helpPracticeCharacters(e,['學校','学校','甲乙','绿'])).map(c=>c.c),['学','校','绿']);
});
test('empty/unknown queries do not invent definitions or modify source data; matching is bounded',()=>{
 const before=JSON.stringify([cards,bank]),e=engine();for(const q of ['','甲乙丙','<img onerror=alert(1)>'])assert.equal(ctx.searchHelpLookup(e,q).total,0);
 const r=ctx.searchHelpLookup(e,'xue',1);assert.equal(r.items.length,1);assert.equal(r.total,4);assert.equal(JSON.stringify([cards,bank]),before);
});
test('curriculum lookup remains usable before the optional dictionary loads',()=>{
 assert.equal(typeof ctx.createHelpLookup,'function');const e=ctx.createHelpLookup(cards,null,['学校']);assert.equal(ctx.searchHelpLookup(e,'nǚ').items[0].text,'女');assert.equal(ctx.searchHelpLookup(e,'stop').items[0].text,'止');
});
