const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {buildUnitGroups}=require('../core/units.js');
const curriculum=require('../content/curriculum.js');
const expected=JSON.parse(fs.readFileSync('tests/fixtures/better-immersion-k5.json'));
function groups(grade,chars){return buildUnitGroups({units:curriculum.units,cards:curriculum.cards,grade,selection:chars}).groups;}
test('My Characters current-grade units exactly match PDF numbers and full character order',()=>{
 for(const [grade,units] of Object.entries(expected)){
  const actual=groups(grade,[...units[0][1]]).filter(h=>h.g===grade&&h.t.startsWith('Unit '));
  assert.deepEqual(actual.map(h=>[Number(h.t.slice(5)),h.c.join('')]),units);
 }
});
test('restored characters from another grade appear in their official full units',()=>{
 const actual=groups('4',['查','狗','猫','买','卖']);
 const grade2=actual.filter(h=>h.g==='2');
 assert.deepEqual(grade2.map(h=>[h.t,h.c.join('')]),[['Unit 1','狗努猫牛像'],['Unit 6','买卖进常出']]);
 assert.ok(grade2.every(h=>h.a));
});
test('supplemental kindergarten sets are distinguished from official PDF units',()=>{
 const actual=groups('K',['一','鱼']);
 assert.ok(actual.some(h=>h.supplemental&&h.c.includes('鱼')));
 assert.equal(new Set(actual.map(h=>h.id)).size,actual.length);
});
