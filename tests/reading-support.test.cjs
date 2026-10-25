const test=require('node:test'),assert=require('node:assert/strict'),api=require('../online-content.js'),catalog=require('../content/online-library.js'),curriculum=require('../content/curriculum.json');
test('reading eligibility uses every character and cumulative curriculum through Grade3',()=>{
 assert.equal(typeof api.eligibleReading,'function','portable grade eligibility exists');
 const grades={K:'我今天下雨',1:'去学校',2:'真',3:'睡',4:'书',5:'念'},item={characters:['我','去','学','校']};
 assert.equal(api.eligibleReading(item,'K',grades),false);assert.equal(api.eligibleReading(item,'1',grades),true);assert.equal(api.eligibleReading(item,'2',grades),true);
 assert.equal(api.eligibleReading({characters:['我','念']},'3',grades),false);assert.equal(api.eligibleReading({characters:['我','念']},'4',grades),true);assert.equal(api.eligibleReading({characters:['未']},'5',grades),true);
 assert.equal(api.eligibleReading({characters:[]},'2',grades),false);assert.equal(api.eligibleReading(item,'unknown',grades),false);
});
test('actual loaded text is checked independently of catalogue character metadata',()=>{
 assert.equal(typeof api.eligibleReadingText,'function','full text gate exists');const grades={K:'我',1:'去学校',2:'真',3:'睡'};
 assert.equal(api.eligibleReadingText(['我去学校。'],'2',grades),true);assert.equal(api.eligibleReadingText(['我去学校。','书'],'2',grades),false);assert.equal(api.eligibleReadingText(['我去学校。','书'],'4',grades),true);
});
test('selected readings expose Chinese labels and grade gating matches the actual school lists',()=>{
 for(const i of catalog.items){assert.ok(i.titleZh&&/\p{Script=Han}/u.test(i.titleZh),'Chinese label: '+i.id);assert.ok(i.characters?.length);assert.ok(i.support?.pinyin?.length);assert.equal(i.support.sourceHash,i.sha256);}
 assert.equal(typeof api.eligibleReading,'function');const counts=['K','1','2','3','4','5'].map(g=>catalog.items.filter(i=>api.eligibleReading(i,g,curriculum.grades)).length);assert.deepEqual(counts,[1,4,5,5,9,9]);
 for(const i of catalog.items.filter(i=>i.kind==='story'))assert.equal(api.eligibleReading(i,'3',curriculum.grades),false,i.id+' is not suitable under the K–3 character rule');
});
test('optional aids are bound to the selected Chinese source and aligned paragraph count',()=>{
 assert.equal(typeof api.readingAids,'function','aligned text support exists');const i={kind:'story',sha256:'a',support:{sourceHash:'a',pinyin:['Wǒ.'],english:['I.']}};
 assert.deepEqual(api.readingAids(i,{paragraphs:['我。'],translation:[]}),{pinyin:['Wǒ.'],translation:['I.']});
 for(const bad of [{...i,support:{...i.support,sourceHash:'other'}},{...i,support:{...i.support,pinyin:[]}},{...i,support:{...i.support,english:['I.','extra']}}])assert.throws(()=>api.readingAids(bad,{paragraphs:['我。'],translation:[]}));
 const sentence={...i,kind:'sentence',support:{sourceHash:'a',pinyin:['Wǒ.'],english:['unselected']}};assert.deepEqual(api.readingAids(sentence,{paragraphs:['我。'],translation:['I.']}),{pinyin:['Wǒ.'],translation:['I.']});
});
