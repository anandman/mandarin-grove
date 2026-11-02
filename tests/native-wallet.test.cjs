const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function app(platform){
 const notices=[],context=vm.createContext({GrovePlatform:{platform},S:{stars:0,cfg:{},rewards:{ribbons:20}}});
 for(const file of ['rewards.js','grove.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
 context.refreshGroveWallet(context.S,100);context.groveRewardUpdate=async()=>{};context.groveActionNotice=value=>notices.push(value);context.showGroveRewards=()=>{};return {context,notices};
}
for(const platform of ['ios','android'])test(platform+' cannot spend or refund a shared wallet before an atomic cloud adapter exists',async()=>{
 for(const [name,value]of [['groveUnlock','violet-leaves'],['groveBuild','reading-nook'],['groveUndo','existing']]){
  const {context:c,notices}=app(platform);let argument=value;
  if(name==='groveUndo'){c.redeemGroveReward(c.S,'violet-leaves',101);argument=c.S.groveRewards.transactions.at(-1).id;}
  const before=JSON.stringify(c.S);assert.equal(typeof c[name],'function');await c[name](argument);assert.equal(JSON.stringify(c.S),before,name+' must preserve every earned/spent value');assert.equal(notices.length,1);
 }
});
test('the native spending guard leaves offline earning and existing web spending intact',async()=>{
 const {context:n}=app('android');assert.equal(n.completeWritingSentence(n.S,'synthetic-sentence',101),1);assert.equal(n.S.groveRewards.balance,21);
 const {context:w}=app('web');await w.groveUnlock('violet-leaves');assert.equal(w.S.groveRewards.balance,17);assert.equal(w.S.groveRewards.owned.includes('violet-leaves'),true);
});
