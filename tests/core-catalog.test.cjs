const test=require('node:test'),assert=require('node:assert/strict');let createCatalog;try{({createCatalog}=require('../core/catalog.js'));}catch{}
const source={characters:[{c:'女',p:'nǚ',m:'woman'},{c:'绿',p:'lǜ',m:'green'},{c:'行',p:'xíng / háng',m:'walk / row'}],units:[{id:'K:2',grade:'K',chars:['女']},{id:'2:1',grade:'2',chars:['绿','行']}]};
test('portable selection keeps arbitrary cross-grade order, excludes untaught and ignores unavailable IDs',()=>{
 assert.equal(typeof createCatalog,'function');const catalog=createCatalog(source);
 assert.deepEqual(catalog.selection({units:['2:1','K:2'],characters:['行','missing'],excluded:['绿']}).map(x=>x.c),['行','女']);
 assert.equal(catalog.character('女').p,'nǚ');assert.equal(catalog.character('绿').p,'lǜ');assert.equal(catalog.character('行').p,'xíng / háng');assert.equal(catalog.character('missing'),null);
});
test('catalog never mutates input or leaks mutable references to units/readings',()=>{
 const before=JSON.stringify(source),catalog=createCatalog(source),unit=catalog.unit('2:1'),card=catalog.character('绿');unit.chars.push('女');card.p='lu';assert.deepEqual(catalog.unit('2:1').chars,['绿','行']);assert.equal(catalog.character('绿').p,'lǜ');assert.equal(JSON.stringify(source),before);
});
