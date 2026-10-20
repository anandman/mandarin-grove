const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({});
for(const file of ['vendor/writing-spark/curriculum-ideas.js','vendor/writing-spark/character-ideas.js','writing.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
test('single characters find related words and traditional input displays simplified words',()=>{
 const rain=c.writingIdeasLookup(' 雨 ');assert.equal(rain.input,'雨');assert.ok(rain.cards.some(x=>x.word==='下雨'));
 const school=c.writingIdeasLookup('學校');assert.equal(school.error,'');assert.equal(school.cards.length,3);assert.ok(school.cards.every(x=>x.word==='学校'));
});
test('compounds match as a whole; invalid and unsupported input cannot produce stale ideas',()=>{
 assert.equal(c.writingIdeasLookup('雨学校').cards.length,0);assert.match(c.writingIdeasLookup('雨学校').error,/not have/);
 for(const input of ['', 'school','雨 学校','雨！','<img>']){const r=c.writingIdeasLookup(input);assert.equal(r.cards.length,0);assert.ok(r.error);}
});
test('each input exhausts its deck and switching inputs preserves its place',()=>{
 let seed=51;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const deck=c.createWritingIdeaDecks(random),cards=c.writingIdeasLookup('雨').cards,seen=new Set();let previous;
 for(let i=0;i<cards.length;i++){
  const card=deck.next('雨',cards);assert.notEqual(card.text,previous);assert.ok(!seen.has(card.text));seen.add(card.text);previous=card.text;
  deck.next('学校',c.writingIdeasLookup('学校').cards);
 }
 assert.equal(seen.size,cards.length);assert.notEqual(deck.next('雨',cards).text,previous);
});
test('a one-card deck remains usable and empty decks have no result',()=>{
 const deck=c.createWritingIdeaDecks(()=>0);assert.equal(deck.next('missing',[]),null);
 const card={word:'雨',text:'A rainy day'};assert.equal(deck.next('rain',[card]),card);assert.equal(deck.next('rain',[card]),card);
});
test('browse lists contain unique simplified forms and support meaning searches',()=>{
 const words=c.writingBrowseEntries('words'),chars=c.writingBrowseEntries('characters');
 assert.equal(words.length,323);assert.equal(chars.length,433);assert.equal(new Set(words.map(x=>x.value)).size,words.length);
 assert.ok(words.some(x=>x.value==='学校'));assert.ok(!words.some(x=>x.value==='學校'));assert.ok(chars.some(x=>x.value==='雨'));
 assert.ok(c.writingBrowseEntries('words','school').every(x=>x.meaning.toLowerCase().includes('school')));
 assert.ok(c.writingBrowseEntries('words','學校').some(x=>x.value==='学校'));
});
