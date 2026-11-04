const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function app(platform){
 let tick=101;const updates=[],messages=[],context=vm.createContext({Date:class extends Date{static now(){return tick++;}},GrovePlatform:{platform},S:{stars:77,cfg:{future:['keep']},future:{raw:'绿'},rewards:{ribbons:20}}});
 for(const file of ['rewards.js','grove.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
 context.refreshGroveWallet(context.S,100);context.S.groveRewards.future={raw:['kept']};context.groveRewardUpdate=async message=>updates.push(message);context.showGroveRewards=message=>messages.push(message);context.groveActionNotice=message=>messages.push(message);return {context,updates,messages};
}
for(const platform of ['web','ios','android']){
 test(platform+' preserves unknown fields inside an imported project when adding its next piece',async()=>{
  const {context:c}=app(platform);c.S.groveRewards.projects['reading-nook']={stage:1,visible:true,future:{preserve:'original',raw:['绿',null]}};
  await c.groveBuild('reading-nook');assert.equal(c.S.groveRewards.balance,17);assert.equal(c.S.groveRewards.projects['reading-nook'].stage,2);assert.deepEqual(JSON.parse(JSON.stringify(c.S.groveRewards.projects['reading-nook'].future)),{preserve:'original',raw:['绿',null]});
 });
 test(platform+' unlocks and refunds local decorations with existing prices and unchanged unknown progress',async()=>{
  const {context:c,updates}=app(platform);await c.groveUnlock('violet-leaves');assert.equal(c.S.groveRewards.balance,17);assert.deepEqual([...c.S.groveRewards.owned],['violet-leaves']);assert.equal(c.S.groveRewards.equipped.trees,'violet-leaves');assert.equal(updates.length,1);
  await c.groveUnlock('violet-leaves');assert.equal(c.S.groveRewards.balance,17,'Repeated unlock cannot charge twice');assert.equal(updates.length,1);
  const receipt=c.S.groveRewards.transactions.at(-1).id;await c.groveUndo(receipt);assert.equal(c.S.groveRewards.balance,20);assert.equal(c.S.groveRewards.owned.length,0);assert.equal(c.S.groveRewards.equipped.trees,undefined);assert.equal(updates.length,2);await c.groveUndo(receipt);assert.equal(c.S.groveRewards.balance,20);assert.equal(updates.length,2);
  assert.equal(c.S.stars,77);assert.equal(c.S.future.raw,'绿');assert.equal(c.S.cfg.future[0],'keep');assert.equal(c.S.groveRewards.future.raw[0],'kept');
 });
 test(platform+' builds stages and refunds only the current last piece through the ordinary save dispatcher',async()=>{
  const {context:c,updates}=app(platform);await c.groveBuild('reading-nook');assert.equal(c.S.groveRewards.balance,18);assert.equal(c.S.groveRewards.projects['reading-nook'].stage,1);const first=c.S.groveRewards.transactions.at(-1).id;
  await c.groveBuild('reading-nook');assert.equal(c.S.groveRewards.balance,15);assert.equal(c.S.groveRewards.projects['reading-nook'].stage,2);const second=c.S.groveRewards.transactions.at(-1).id;
  await c.groveUndo(first);assert.equal(c.S.groveRewards.balance,15,'Earlier pieces remain while a later stage exists');assert.equal(updates.length,2);
  await c.groveUndo(second);assert.equal(c.S.groveRewards.balance,18);assert.equal(c.S.groveRewards.projects['reading-nook'].stage,1);assert.equal(updates.length,3);
 });
 test(platform+' preserves insufficient purchases while offline practice earning remains available',async()=>{
  const {context:c,updates}=app(platform);c.S.groveRewards.balance=0;const before=JSON.stringify(c.S);await c.groveUnlock('violet-leaves');await c.groveBuild('reading-nook');assert.equal(JSON.stringify(c.S),before);assert.equal(updates.length,0);
  assert.equal(c.completeWritingSentence(c.S,'synthetic-sentence',200),1);assert.equal(c.S.groveRewards.balance,1);assert.equal(c.completeWritingSentence(c.S,'synthetic-sentence',201),0);assert.equal(c.S.groveRewards.balance,1);
 });
}
