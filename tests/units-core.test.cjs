const test=require('node:test'),assert=require('node:assert/strict'),units=require('./fixtures/better-immersion-k5.json');let buildUnitGroups;try{({buildUnitGroups}=require('../core/units.js'));}catch{}
const cards=[...new Set(Object.values(units).flatMap(rows=>rows.flatMap(([,s])=>[...s])))].map(c=>({c,g:Object.keys(units).filter(g=>units[g].some(([,s])=>s.includes(c))).join('')}));cards.push({c:'鱼',g:'K'},{c:'羊',g:'K'});
test('all current-grade official units keep exact PDF order and stable IDs',()=>{
 assert.equal(typeof buildUnitGroups,'function');for(const grade of Object.keys(units)){const actual=buildUnitGroups({units,cards,grade,selection:[...units[grade][0][1]],points:{}});assert.deepEqual(actual.groups.filter(g=>g.g===grade&&!g.supplemental).map(g=>[g.number,g.c.join('')]),units[grade]);assert.equal(new Set(actual.groups.map(g=>g.id)).size,actual.groups.length);}
});
test('cross-grade selected characters show their whole official units, including untaught neighbours',()=>{
 const actual=buildUnitGroups({units,cards,grade:'4',selection:['查','狗','猫','买','卖'],points:{}});assert.deepEqual(actual.groups.filter(g=>g.g==='2').map(g=>[g.t,g.c.join('')]),[['Unit 1','狗努猫牛像'],['Unit 6','买卖进常出']]);
});
test('supplemental characters stay explicit and earned progress never drives automatic unit selection',()=>{
 const selection=['一','鱼'],points={一:9},before=JSON.stringify([selection,points]);const result=buildUnitGroups({units,cards,grade:'K',selection,points});assert.ok(result.groups.some(g=>g.supplemental&&g.c.includes('鱼')));assert.equal(JSON.stringify([selection,points]),before);
});
