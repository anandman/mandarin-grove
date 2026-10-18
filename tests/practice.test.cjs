const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js', 'utf8');
const dataLine = source.split('\n').find(l => l.startsWith('const ALL='));
const ctx = vm.createContext({});
vm.runInContext(dataLine + ';globalThis.cards=ALL;globalThis.units=U;', ctx);
const helperPath = 'practice.js';
if (fs.existsSync(helperPath)) vm.runInContext(fs.readFileSync(helperPath, 'utf8'), ctx);
const card = c => ctx.cards.find(x => x.c === c);

test('K–5 unit numbers, characters and order match the PDF', () => {
 const expected = JSON.parse(fs.readFileSync('tests/fixtures/better-immersion-k5.json'));
 assert.deepEqual(JSON.parse(JSON.stringify(ctx.units)), expected);
});
test('both readings of 假 are gradable without accepting wrong tones', () => {
 assert.equal(ctx.pinyinMatches(card('假'), 'jia', 3), true);
 assert.equal(ctx.pinyinMatches(card('假'), 'jia', 4), true);
 assert.equal(ctx.pinyinMatches(card('假'), 'jia', 2), false);
});
test('slash-separated readings are separate answers with enough letter tiles', () => {
 assert.equal(ctx.pinyinMatches(card('长'), 'zhang', 3), true);
 assert.equal(ctx.pinyinMatches(card('长'), 'chang', 2), true);
 assert.equal(ctx.pinyinMatches(card('长'), 'chang', 3), false);
 for(const c of ctx.cards) {
  const tiles=ctx.pinyinLetters(c);
  assert.ok(!tiles.includes('/'));
  for(const p of ctx.readings(c)) {
   const remaining=[...tiles];
   for(const ch of ctx.pinyinBase(p)) { const i=remaining.indexOf(ch);assert.ok(i>=0,`${c.c}: ${p}`);remaining.splice(i,1); }
  }
 }
});
test('ü is distinct from u and neutral tone is supported', () => {
 assert.equal(ctx.pinyinBase('lǜ'),'lv');
 assert.equal(ctx.pinyinMatches({p:'lǜ'},'lu',4),false);
 assert.equal(ctx.pinyinMatches({p:'le / liǎo'},'le',0),true);
});
test('problem speech prompts use clarifying context and correct display data', () => {
 assert.equal(card('子').p,'zǐ');
 assert.equal(ctx.speechText(card('子')),'子，子女的子');
 assert.equal(ctx.speechText(card('假')),'假期的假');
 assert.equal(ctx.speechText(card('狗')),'狗，小狗的狗');
});
test('old reordered quizzes still resolve to the same official unit', () => {
 assert.equal(ctx.canonicalQuiz('卖买常进出',ctx.units['2']),'买卖进常出');
 assert.equal(ctx.canonicalQuiz('买卖',ctx.units['2']),'买卖');
});
test('cram includes every selected character exactly once, including locked units', () => {
 const result=ctx.cramCharacters(ctx.units['4'],[1,6],ctx.cards);
 assert.equal(result.length,18);
 assert.equal(new Set(result.map(c=>c.c)).size,18);
 assert.ok(result.some(c=>c.c==='假'));
 assert.equal(ctx.cramCharacters(ctx.units['4'],ctx.units['4'].map(u=>u[0]),ctx.cards).length,117);
});

test('满 keeps third-tone grading without a character-specific voice workaround',()=>{
 assert.equal(card('满').p,'mǎn');assert.equal(ctx.pinyinMatches(card('满'),'man',3),true);
 assert.equal(ctx.pinyinMatches(card('满'),'man',4),false);
 assert.equal(ctx.speechText(card('满')),'满');
});
