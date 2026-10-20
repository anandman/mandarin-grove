const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({});vm.runInContext(fs.readFileSync('rewards.js','utf8'),c);
const state=n=>({stars:149,pts:{狗:6},rewards:{ribbons:n,characters:{狗:{tier:1}}}});
test('existing ribbons credit fruit once without converting stars or badges',()=>{const s=state(12);assert.equal(c.refreshGroveWallet(s,100),12);assert.equal(c.refreshGroveWallet(s,101),0);assert.equal(s.groveRewards.balance,12);assert.equal(s.stars,149);assert.equal(s.rewards.characters['狗'].tier,1);assert.equal(s.groveRewards.transactions.length,1)});
test('a changed earning policy applies only to new ribbons',()=>{const s=state(3);c.refreshGroveWallet(s,100);s.rewards.ribbons=4;assert.equal(c.refreshGroveWallet(s,101,{version:2,fruitPerRibbon:2}),2);assert.equal(s.groveRewards.balance,5);assert.equal(c.refreshGroveWallet(s,102,{version:2,fruitPerRibbon:2}),0)});
test('redemption is affordable, idempotent and rejects unknown rewards',()=>{const s=state(3);c.refreshGroveWallet(s);assert.equal(c.redeemGroveReward(s,'missing'),false);assert.equal(c.redeemGroveReward(s,'sunrise'),false);assert.equal(c.redeemGroveReward(s,'violet-leaves',100),true);assert.equal(s.groveRewards.balance,0);assert.equal(c.redeemGroveReward(s,'violet-leaves',101),false);assert.equal(c.selectGroveDecoration(s,'sunrise'),false)});
test('an accidental unlock can be undone exactly once with full refund',()=>{const s=state(5);c.refreshGroveWallet(s);c.redeemGroveReward(s,'violet-leaves',100);const tx=s.groveRewards.transactions.at(-1).id;assert.equal(c.undoGroveUnlock(s,tx,101),true);assert.equal(s.groveRewards.balance,5);assert.equal(s.groveRewards.selected,null);assert.equal(s.groveRewards.owned.length,0);assert.equal(c.undoGroveUnlock(s,tx,102),false);assert.equal(s.groveRewards.balance,5)});
test('refund uses the actual paid cost when the catalog changes',()=>{const s=state(5);c.refreshGroveWallet(s);c.redeemGroveReward(s,'custom',100,[{id:'custom',cost:2}]);const tx=s.groveRewards.transactions.at(-1).id;assert.equal(c.undoGroveUnlock(s,tx),true);assert.equal(s.groveRewards.balance,5)});
test('wallet and applied decoration survive backup without duplicate credit',()=>{const s=state(8);c.refreshGroveWallet(s);c.redeemGroveReward(s,'butterfly',100);const restored=JSON.parse(JSON.stringify(s));assert.equal(c.refreshGroveWallet(restored),0);assert.equal(restored.groveRewards.balance,4);assert.equal(restored.groveRewards.selected,'butterfly');assert.equal(restored.stars,149)});
test('children do not share wallet arrays or ownership',()=>{const a=state(5),b=state(5);c.refreshGroveWallet(a);c.refreshGroveWallet(b);c.redeemGroveReward(a,'violet-leaves');assert.equal(b.groveRewards.balance,5);assert.equal(b.groveRewards.owned.length,0)});
test('a self-declared sentence earns fruit once without mastery or practice evidence',()=>{
 const s=state(2),before=JSON.stringify(s);c.refreshGroveWallet(s,100);
 assert.equal(c.completeWritingSentence(s,'idea-1',101),1);assert.equal(c.completeWritingSentence(s,'idea-1',102),0);
 assert.equal(s.groveRewards.balance,3);assert.equal(s.groveRewards.writingSentences,1);
 assert.equal(JSON.stringify(Object.fromEntries(Object.entries(s).filter(([key])=>key!=='groveRewards'))),before);
 assert.equal(c.refreshGroveWallet(s,103),0);
 const restored=JSON.parse(JSON.stringify(s));assert.equal(c.completeWritingSentence(restored,'idea-1',104),0);
 assert.equal(c.completeWritingSentence(restored,'idea-2',105),1);assert.equal(restored.groveRewards.writingSentences,2);
 assert.equal(s.groveRewards.writingSentences,1);
});
test('writing reward amounts are policy controlled and existing fruit is preserved',()=>{
 const s=state(1);c.refreshGroveWallet(s,100);
 assert.equal(c.completeWritingSentence(s,'idea-1',101,{version:2,fruitPerSentence:2}),2);
 assert.equal(s.groveRewards.balance,3);assert.equal(c.completeWritingSentence(s,'',102),0);
 assert.equal(s.groveRewards.transactions.at(-1).source,'writing-sentence');
});
test('unit trees recognize original character progress without inventing skill evidence',()=>{
 vm.runInContext(fs.readFileSync('grove.js','utf8'),c);
 c.S={pts:{祖:6,止:2},learning:{chars:{离:{skills:{listen:{attempts:2,skips:1}}},子:{skills:{listen:{attempts:1,skips:1}}}}}};
 const before=JSON.stringify(c.S),growth=c.unitGroveGrowth(['祖','止','离','子']);
 assert.equal(growth.practiced,3);assert.equal(growth.badges,0);assert.equal(growth.stage,1);
 assert.equal(JSON.stringify(c.S),before);
});
test('original stars receive one-time recognition without changing character progress',()=>{
 const s={stars:149,pts:{祖:9},box:{祖:2},due:{祖:20000},bad:{pq:100},cfg:{set:['祖']}};
 const original=JSON.stringify(s);assert.equal(c.creditLegacyStars(s,100),14);
 assert.equal(s.groveRewards.balance,14);assert.equal(s.groveRewards.legacyCredit.stars,149);
 assert.equal(JSON.stringify(Object.fromEntries(Object.entries(s).filter(([key])=>key!=='groveRewards'))),original);
 assert.equal(c.creditLegacyStars(s,101),0);s.stars=999;assert.equal(c.creditLegacyStars(s,102),0);
 assert.equal(s.groveRewards.balance,14);assert.equal(s.learning,undefined);
});
test('recognition subtracts previously earned ribbon fruit even after spending',()=>{
 const s=state(12);c.refreshGroveWallet(s,100);c.redeemGroveReward(s,'violet-leaves',101);
 c.completeWritingSentence(s,'sentence-1',102);
 assert.equal(c.creditLegacyStars(s,103),2);assert.equal(s.groveRewards.balance,12);
 assert.equal(s.groveRewards.legacyCredit.ribbonFruit,12);assert.equal(s.groveRewards.owned[0],'violet-leaves');
 s.rewards.ribbons=13;assert.equal(c.refreshGroveWallet(s,104),1,'Future practice still earns immediately');
 assert.equal(c.creditLegacyStars(s,105),0);
});
test('recognition never deducts earned fruit or rewards newly earned stars later',()=>{
 const s=state(20);c.refreshGroveWallet(s,100);assert.equal(c.creditLegacyStars(s,101),0);assert.equal(s.groveRewards.balance,20);
 const fresh={stars:0};assert.equal(c.creditLegacyStars(fresh,100),0);fresh.stars=100;
 assert.equal(c.creditLegacyStars(fresh,101),0);assert.equal(fresh.groveRewards.balance,0);
});
test('recognition survives backup, policy changes, and old wallet upgrades',()=>{
 const s=state(12);c.refreshGroveWallet(s,100);delete s.groveRewards.ribbonFruitTotal;
 assert.equal(c.creditLegacyStars(s,101),2);c.redeemGroveReward(s,'butterfly',102);
 const restored=JSON.parse(JSON.stringify(s)),balance=restored.groveRewards.balance;
 assert.equal(c.creditLegacyStars(restored,103,{version:4,legacyStarsPerFruit:5}),0);assert.equal(restored.groveRewards.balance,balance);
});
test('legacy overlap uses actual ribbon earnings across earning-policy changes',()=>{
 const s=state(4);c.refreshGroveWallet(s,100);s.rewards.ribbons=5;
 c.refreshGroveWallet(s,101,{version:5,fruitPerRibbon:2});
 assert.equal(s.groveRewards.ribbonFruitTotal,6);assert.equal(c.creditLegacyStars(s,102),8);
});
