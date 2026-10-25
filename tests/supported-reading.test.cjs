const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const api=()=>{assert.ok(fs.existsSync('core/readings.js'),'portable reading helpers exist');return require('../core/readings.js');};
test('reading aids align individual sentences even when a source paragraph contains two',()=>{
 const rows=api().readingSentences(['我看书。你呢？'],{pinyin:['Wǒ kànshū. Nǐ ne?'],translation:['I read. And you?']});
 assert.deepEqual(rows,[{text:'我看书。',pinyin:'Wǒ kànshū.',english:'I read.',words:[]},{text:'你呢？',pinyin:'Nǐ ne?',english:'And you?',words:[]}]);
 assert.throws(()=>api().readingSentences(['我看书。你呢？'],{pinyin:['Wǒ kànshū.'],translation:['I read.']}),/align/);
});
test('tap lookup keeps phrases together, permits unknown characters and preserves punctuation',()=>{
 const index=new Map([['学校',[['学校','','xue2 xiao4','school']]],['学',[['学','','xue2','study']]]]);
 const rows=api().readingTokens('我去学校。鑫',index);
 assert.equal(rows.map(r=>r.text).join(''),'我去学校。鑫');assert.ok(rows.some(r=>r.text==='学校'&&r.lookup));assert.ok(rows.some(r=>r.text==='鑫'&&r.lookup));assert.equal(rows.find(r=>r.text==='。').lookup,false);
 const marked=api().readingTokens('银行',index,[{word:'银行',pinyin:'yínháng',meaning:'bank'}]);assert.equal(marked[0].meaning,'bank');assert.equal(marked[0].pinyin,'yínháng');
});
test('reading recommendations target the actual selected characters with prior-grade support and exclusions',()=>{
 const grades={K:'我你有小',1:'家学校',2:'猫狗树',3:'河',4:'船'};
 assert.equal(typeof api().readingScope,'function');
 const scope=api().readingScope({grade:'2',chars:['猫'],excluded:['你'],grades});
 assert.equal(api().readingMatch({characters:['我','家','有','小','猫'],minGrade:2},scope).eligible,true);
 assert.equal(api().readingMatch({characters:['我','家','有','狗']},scope).eligible,false,'unselected current-grade words do not slip in');
 assert.equal(api().readingMatch({characters:['我','你','猫']},scope).eligible,false,'explicitly deferred support characters stay excluded');
 assert.equal(api().readingMatch({characters:['我','家']},scope).eligible,false,'reading must practise a selected target');
 assert.equal(api().readingMatch({characters:['我','猫','船']},api().readingScope({grade:'4',chars:['猫'],excluded:[],grades})).eligible,true);
 assert.equal(api().readingMatch({characters:['我']},api().readingScope({grade:'2',chars:[],grades})).eligible,false);
});
test('Grade2 starter readings contain only curriculum characters and have aligned contextual aids',()=>{
 assert.ok(fs.existsSync('content/reading-practice.js'),'offline starter readings exist');const pack=require('../content/reading-practice.js'),curriculum=require('../content/curriculum.json');
 assert.ok(pack.items.length>=3);
 for(const item of pack.items){
  const allowed=new Set(['K','1','2'].flatMap(g=>[...curriculum.grades[g]]));
  for(const ch of (item.titleZh+item.paragraphs.join('')).match(/\p{Script=Han}/gu))assert.ok(allowed.has(ch),item.id+' unexpected '+ch);
  const sentences=api().readingSentences(item.paragraphs,{pinyin:item.support.pinyin,translation:item.support.english},item.annotations);assert.ok(sentences.length>=3);
  assert.deepEqual([...new Set((item.titleZh+item.paragraphs.join('')).match(/\p{Script=Han}/gu))].sort(),item.characters.slice().sort());
 }
});
