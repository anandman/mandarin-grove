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
