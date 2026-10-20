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
test('an old wallet migrates its active decoration without changing purchases or earnings',()=>{
 const s=state(12);c.refreshGroveWallet(s,100);c.redeemGroveReward(s,'butterfly',101);
 const old=s.groveRewards;delete old.equipped;delete old.projects;old.version=1;
 const balance=old.balance,history=JSON.stringify(old.transactions);
 c.refreshGroveWallet(s,102);
 assert.equal(old.equipped.visitors,'butterfly');assert.equal(old.balance,balance);
 assert.equal(JSON.stringify(old.transactions),history);assert.equal(old.owned[0],'butterfly');
});
test('decorations in different slots combine, switching and removing them is free',()=>{
 const s=state(40);c.refreshGroveWallet(s);
 for(const id of ['violet-leaves','sunrise','flowers','bench','butterfly'])assert.equal(c.redeemGroveReward(s,id),true);
 assert.deepEqual(JSON.parse(JSON.stringify(c.groveEquipped(s))),{trees:'violet-leaves',sky:'sunrise',ground:'flowers',furniture:'bench',visitors:'butterfly'});
 const balance=s.groveRewards.balance;
 assert.equal(c.clearGroveSlot(s,'sky'),true);assert.equal(c.groveEquipped(s).trees,'violet-leaves');
 assert.equal(c.selectGroveDecoration(s,'sunrise'),true);assert.equal(s.groveRewards.balance,balance);
 assert.equal(c.selectGroveDecoration(s,null),true);assert.equal(Object.keys(c.groveEquipped(s)).length,0);
 assert.equal(s.groveRewards.owned.length,5);
});
test('refund removes only its own equipped decoration and keeps the other slots',()=>{
 const s=state(20);c.refreshGroveWallet(s);c.redeemGroveReward(s,'violet-leaves',100);c.redeemGroveReward(s,'butterfly',101);
 const tx=s.groveRewards.transactions.at(-1);assert.equal(c.undoGroveUnlock(s,tx.id),true);
 assert.equal(c.groveEquipped(s).trees,'violet-leaves');assert.equal(c.groveEquipped(s).visitors,undefined);
});
test('projects buy one visible stage at a time and refund only the latest stage',()=>{
 const s=state(30);c.refreshGroveWallet(s);
 assert.equal(c.buildGroveProject(s,'missing'),false);
 assert.equal(c.buildGroveProject(s,'reading-nook',100),true);const first=s.groveRewards.transactions.at(-1);
 assert.equal(s.groveRewards.projects['reading-nook'].stage,1);assert.equal(s.groveRewards.balance,28);
 c.buildGroveProject(s,'reading-nook',101);const second=s.groveRewards.transactions.at(-1);
 assert.equal(c.undoGroveUnlock(s,first.id),false,'An earlier piece cannot remove the pieces built above it');
 assert.equal(c.undoGroveUnlock(s,second.id),true);assert.equal(s.groveRewards.projects['reading-nook'].stage,1);
 assert.equal(s.groveRewards.balance,28);assert.equal(c.undoGroveUnlock(s,second.id),false);
 for(let i=0;i<3;i++)assert.equal(c.buildGroveProject(s,'reading-nook',102+i),true);
 assert.equal(c.buildGroveProject(s,'reading-nook',110),false);assert.equal(s.groveRewards.balance,18);
 assert.equal(c.setGroveProjectVisible(s,'reading-nook',false),true);assert.equal(s.groveRewards.projects['reading-nook'].visible,false);
 assert.equal(c.setGroveProjectVisible(s,'reading-nook',true),true);assert.equal(s.groveRewards.balance,18);
});
test('unaffordable project pieces do not change wallet, and refund preserves the paid price',()=>{
 const s=state(1);c.refreshGroveWallet(s);const before=JSON.stringify(s);
 assert.equal(c.buildGroveProject(s,'reading-nook',100),false);assert.equal(JSON.stringify(s),before);
 s.groveRewards.balance=10;c.buildGroveProject(s,'reading-nook',101,[{id:'reading-nook',stages:[{name:'Mat',cost:4}]}]);
 assert.equal(c.undoGroveUnlock(s,s.groveRewards.transactions.at(-1).id,102),true);assert.equal(s.groveRewards.balance,10);
});
test('chosen goals track the next affordable piece and survive backups per child',()=>{
 const s=state(1);c.refreshGroveWallet(s);
 assert.equal(c.pinGroveGoal(s,'missing'),false);assert.equal(c.pinGroveGoal(s,'project:reading-nook'),true);
 assert.equal(c.groveGoalStatus(s).remaining,1);assert.equal(c.groveGoalStatus(s).cost,2);
 s.groveRewards.balance=5;c.buildGroveProject(s,'reading-nook',100);
 const restored=JSON.parse(JSON.stringify(s));assert.match(c.groveGoalStatus(restored).name,/bookshelf/i);
 assert.equal(c.groveGoalStatus(restored).remaining,0);assert.equal(c.groveGoalStatus(state(0)),null);
 assert.equal(c.pinGroveGoal(restored,'violet-leaves'),true);c.redeemGroveReward(restored,'violet-leaves',101);
 assert.equal(c.groveGoalStatus(restored),null);
});
test('zoo friends are free visitors earned across all characters, independent of practice selection',()=>{
 const s=state(0);s.pts={一:5,二:8,三:2};s.cfg={set:['三']};c.refreshGroveWallet(s);
 const animals=['🐶','🐱','🐮'];assert.equal(c.groveZooFriends(s,animals).length,2);
 assert.equal(c.selectGroveZooVisitor(s,1,animals),true);assert.equal(c.groveEquipped(s).visitors,'zoo:1');
 assert.equal(c.selectGroveZooVisitor(s,2,animals),false);assert.equal(c.selectGroveZooVisitor(s,-1,animals),false);
 assert.equal(s.groveRewards.balance,0);assert.equal(s.groveRewards.transactions.length,0);
 assert.equal(c.selectGroveDecoration(s,'butterfly'),false);
});
test('catalog collections are permanent celebrations and never supply mastery evidence or more money',()=>{
 const s=state(100);c.refreshGroveWallet(s);const source=JSON.stringify({pts:s.pts,rewards:s.rewards});
 const sky=vm.runInContext('GROVE_REWARD_CATALOG.filter(r=>r.slot==="sky")',c);assert.equal(sky.length,4);
 for(let i=0;i<sky.length;i++)c.redeemGroveReward(s,sky[i].id,100+i);
 assert.equal(s.groveRewards.collections.sky,103);const balance=s.groveRewards.balance;
 const tx=s.groveRewards.transactions.at(-1);c.undoGroveUnlock(s,tx.id,104);
 assert.equal(s.groveRewards.collections.sky,103);assert.equal(s.groveRewards.balance,balance-tx.amount);
 assert.equal(JSON.stringify({pts:s.pts,rewards:s.rewards}),source);
 assert.equal(vm.runInContext('GROVE_REWARD_CATALOG.length',c),20);
 assert.equal(vm.runInContext('GROVE_PROJECT_CATALOG.length',c),2);
});
