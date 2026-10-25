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
