// Pure reward policy and state. Quiz/SRS code supplies evidence; UI consumes events.
const REWARD_POLICY=Object.freeze({version:3,stepsPerRibbon:10,successesPerBadge:2,fruitPerRibbon:1,fruitPerSentence:1,legacyStarsPerFruit:10});
const GROVE_REWARD_CATALOG=Object.freeze([
 {id:'violet-leaves',slot:'trees',icon:'🍃',name:'Violet leaves',description:'Dress your trees in violet.',cost:3},
 {id:'blossoms',slot:'trees',icon:'🌸',name:'Spring blossoms',description:'Little blossoms among the oranges.',cost:5},
 {id:'golden-leaves',slot:'trees',icon:'🍂',name:'Golden leaves',description:'An autumn afternoon in your grove.',cost:5},
 {id:'wishing-tree',slot:'trees',icon:'🎋',name:'Wishing ribbons',description:'Violet ribbons dance in the branches.',cost:6},
 {id:'sunrise',slot:'sky',icon:'🌅',name:'Sunrise glow',description:'A warm sunrise behind your trees.',cost:6},
 {id:'kite',slot:'sky',icon:'🪁',name:'Violet kite',description:'A kite floating above the grove.',cost:3},
 {id:'rainbow',slot:'sky',icon:'🌈',name:'Orchard rainbow',description:'A bright arch after the rain.',cost:7},
 {id:'starry-sky',slot:'sky',icon:'🌙',name:'Moon & stars',description:'A peaceful sky for evening stories.',cost:8},
 {id:'flowers',slot:'ground',icon:'🌼',name:'Wildflowers',description:'A small patch of cheerful flowers.',cost:1},
 {id:'stepping-stones',slot:'ground',icon:'🪨',name:'Stepping stones',description:'A winding path to your favorite tree.',cost:2},
 {id:'mushrooms',slot:'ground',icon:'🍄',name:'Tiny mushrooms',description:'A little woodland discovery.',cost:2},
 {id:'pond',slot:'ground',icon:'💧',name:'Little pond',description:'A quiet spot with a lily pad.',cost:6},
 {id:'book-basket',slot:'furniture',icon:'🧺',name:'Book basket',description:'Keep a few stories close by.',cost:2},
 {id:'lantern',slot:'furniture',icon:'🏮',name:'Reading lantern',description:'A warm light for your reading spot.',cost:4},
 {id:'bench',slot:'furniture',icon:'🪑',name:'Orchard bench',description:'A place to sit beneath the trees.',cost:5},
 {id:'birdbath',slot:'furniture',icon:'🐦',name:'Birdbath',description:'A little splash for passing birds.',cost:6},
 {id:'butterfly',slot:'visitors',icon:'🦋',name:'Butterfly visitor',description:'Invite a butterfly into your grove.',cost:4},
 {id:'ladybug',slot:'visitors',icon:'🐞',name:'Ladybug visitor',description:'A tiny friend with spotted wings.',cost:2},
 {id:'snail',slot:'visitors',icon:'🐌',name:'Snail visitor',description:'A friend who grows at their own pace.',cost:2},
 {id:'bumblebee',slot:'visitors',icon:'🐝',name:'Bumblebee visitor',description:'A busy helper for the blossoms.',cost:3}
]);
const GROVE_PROJECT_CATALOG=Object.freeze([
 {id:'reading-nook',icon:'📚',name:'Reading nook',description:'Build a cozy corner, one piece at a time.',stages:[{name:'Woven mat',cost:2},{name:'Bookshelf',cost:3},{name:'Reading cushion',cost:3},{name:'Violet canopy',cost:4}]},
 {id:'treehouse',icon:'🏡',name:'Treehouse',description:'Make a little hideaway in your orange tree.',stages:[{name:'Ladder',cost:3},{name:'Platform',cost:3},{name:'Window walls',cost:4},{name:'Treehouse roof',cost:4}]}
]);
const GROVE_SLOTS=Object.freeze({sky:'Sky',trees:'Trees',ground:'Ground',furniture:'Reading spot',visitors:'Visitors'});
// Achievements are permanent; spaced-review levels remain separate and can decrease.
function rewardSkills(grade,char){
 const skills=['listen'];
 if(grade!=='K')skills.push('recall');
 if(Number(grade)>=2&&characterNeedsPinyin(char))skills.push('pinyin');
 return skills;
}
function rewardEvidence(s,char,skill){
 if(skill!=='recall')return skillState(s,char,skill);
 const memory=skillState(s,char,'memory'),writing=skillState(s,char,'writing');
 // Both tasks demonstrate recall; keep spaced levels separate and use the stronger one.
 return {correct:memory.correct+writing.correct,level:Math.max(memory.level,writing.level)};
}
function practiceSteps(s){return Object.values(s.learning?.chars||{}).reduce((n,c)=>n+Object.values(c.skills).reduce((v,r)=>v+Math.max(0,(r.attempts||0)-(r.skips||0)),0),0)}
function rewardChallenges(s,grade){
 const chars=Object.values(s.learning?.chars||{}),graded=r=>Math.max(0,(r?.attempts||0)-(r?.skips||0));
 const practiced=chars.filter(c=>Object.values(c.skills).some(r=>graded(r)>0)).length;
 const listening=chars.reduce((n,c)=>n+(c.skills.listen?.correct||0),0);
 const writing=chars.reduce((n,c)=>n+['trace','memory','writing'].reduce((v,m)=>v+graded(c.skills[m]),0),0);
 const modes=new Set(chars.flatMap(c=>Object.entries(c.skills).filter(([,r])=>graded(r)>0).map(([m])=>m==='pinyin'||m==='writing'?'dictation':m))).size;
 const steps=practiceSteps(s),collection=Object.keys(s.rewards?.characters||{}).length;
 const challenges=[
  {id:'first_steps',icon:'👣',name:'First steps',value:steps,target:10,description:'Complete 10 practice steps'},
  {id:'explorer',icon:'🧭',name:'Explorer',value:practiced,target:5,description:'Practice 5 different characters'},
  {id:'listener',icon:'👂',name:'Excellent ears',value:listening,target:10,description:'Get 10 listening answers right'},
  {id:'artist',icon:'🎨',name:'Creative hands',value:writing,target:10,description:'Complete 10 writing or tracing steps'},
  {id:'adventurer',icon:'🚀',name:'Activity adventurer',value:modes,target:3,description:'Try 3 different activities'},
  {id:'collector',icon:'🧺',name:'Character collector',value:collection,target:3,description:'Earn 3 character badges'},
  {id:'persistent',icon:'🐝',name:'Busy bee',value:steps,target:50,description:'Complete 50 practice steps'},
  {id:'ribbon_collector',icon:'🎗️',name:'Ribbon collector',value:Math.floor(steps/REWARD_POLICY.stepsPerRibbon),target:10,description:'Earn 10 practice ribbons'}
 ];
 if(Number(grade)>=2)challenges.push({id:'pinyin',icon:'拼',name:'Pinyin builder',value:chars.reduce((n,c)=>n+(c.skills.pinyin?.correct||0),0),target:10,description:'Get 10 pinyin answers right'});
 return challenges;
}
function refreshRewardState(s,grade,now=Date.now()){
 const rewards=s.rewards ||= {version:1,characters:{},ribbons:0};
 const earned=[],steps=practiceSteps(s),ribbons=Math.floor(steps/REWARD_POLICY.stepsPerRibbon);
 if(ribbons>rewards.ribbons){rewards.ribbons=ribbons;earned.push({kind:'ribbon',count:ribbons});}
 for(const char of Object.keys(s.learning?.chars||{})){
  const evidence=rewardSkills(grade,char).map(skill=>rewardEvidence(s,char,skill));
  let tier=evidence.every(r=>r.correct>=REWARD_POLICY.successesPerBadge)?1:0;
  if(tier&&evidence.every(r=>r.level>=2))tier=2;
  if(tier&&evidence.every(r=>r.level>=3))tier=3;
  const previous=rewards.characters[char]?.tier||0;
  if(tier>previous){rewards.characters[char]={tier,earnedAt:now,firstEarnedAt:rewards.characters[char]?.firstEarnedAt||now};earned.push({kind:'character',char,tier});}
 }
 rewards.achievements ||= {};
 for(const challenge of rewardChallenges(s,grade)){
  if(challenge.value>=challenge.target&&!rewards.achievements[challenge.id]){rewards.achievements[challenge.id]=now;earned.push({kind:'challenge',icon:challenge.icon,name:challenge.name});}
 }
 const fruit=refreshGroveWallet(s,now);if(fruit)earned.push({kind:'fruit',amount:fruit});
 return earned;
}

function groveWallet(s){return s.groveRewards||{version:1,creditedRibbons:0,balance:0,owned:[],transactions:[],selected:null};}
function groveEquipped(s){
 const wallet=groveWallet(s);if(wallet.equipped)return wallet.equipped;
 const reward=GROVE_REWARD_CATALOG.find(r=>r.id===wallet.selected&&wallet.owned.includes(r.id));
 return reward?{[reward.slot]:reward.id}:{};
}
function ensureGroveWallet(s){
 const wallet=s.groveRewards ||= {...groveWallet(s)};
 wallet.equipped ||= {...groveEquipped(s)};wallet.projects ||= {};wallet.collections ||= {};
 wallet.version=Math.max(2,wallet.version||1);return wallet;
}
function refreshGroveWallet(s,now=Date.now(),policy=REWARD_POLICY){
 const wallet=ensureGroveWallet(s);refreshGroveCollections(s,now);
 // All published wallets before this counter earned exactly one orange per ribbon.
 wallet.ribbonFruitTotal ??= wallet.creditedRibbons;
 const ribbons=s.rewards?.ribbons||0,newRibbons=Math.max(0,ribbons-wallet.creditedRibbons);
 if(!newRibbons)return 0;
 const amount=newRibbons*policy.fruitPerRibbon;
 wallet.balance+=amount;wallet.creditedRibbons=ribbons;wallet.ribbonFruitTotal+=amount;
 wallet.transactions.push({id:'ribbons:'+ribbons,type:'earn',amount,at:now,policy:policy.version});
 wallet.transactions=wallet.transactions.slice(-100);return amount;
}
function creditLegacyStars(s,now=Date.now(),policy=REWARD_POLICY){
 const wallet=ensureGroveWallet(s);
 if(wallet.legacyCredit)return 0;
 const stars=Number.isFinite(s.stars)?Math.max(0,Math.floor(s.stars)):0;
 const ribbonFruit=wallet.ribbonFruitTotal??wallet.creditedRibbons;
 const amount=Math.max(0,Math.floor(stars/policy.legacyStarsPerFruit)-ribbonFruit);
 // Record even a zero credit, so future stars cannot trigger another migration.
 wallet.legacyCredit={version:1,stars,rate:policy.legacyStarsPerFruit,ribbonFruit,amount,at:now};
 if(amount){
  wallet.balance+=amount;
  wallet.transactions.push({id:'legacy-stars:v1',type:'earn',source:'legacy-stars',amount,at:now,policy:policy.version});
  wallet.transactions=wallet.transactions.slice(-100);
 }
 return amount;
}
function redeemGroveReward(s,id,now=Date.now(),catalog=GROVE_REWARD_CATALOG){
 const reward=catalog.find(x=>x.id===id),wallet=s.groveRewards;
 if(!reward||!wallet||wallet.owned.includes(id)||!Number.isInteger(reward.cost)||reward.cost<0||wallet.balance<reward.cost)return false;
 ensureGroveWallet(s);wallet.balance-=reward.cost;wallet.owned.push(id);wallet.selected=id;
 if(reward.slot)wallet.equipped[reward.slot]=id;
 if(wallet.goal===id)wallet.goal=null;
 wallet.transactions.push({id:'unlock:'+id+':'+now,type:'unlock',reward:id,amount:-reward.cost,at:now});
 wallet.transactions=wallet.transactions.slice(-100);refreshGroveCollections(s,now);return true;
}
function undoGroveUnlock(s,transactionId,now=Date.now()){
 const wallet=s.groveRewards,tx=wallet?.transactions.find(x=>x.id===transactionId&&['unlock','build'].includes(x.type)&&!x.undone);
 if(!tx)return false;
 if(tx.type==='build'){
  if(wallet.projects?.[tx.project]?.stage!==tx.stage)return false;
  wallet.projects[tx.project].stage--;
 }else{
  if(!wallet.owned.includes(tx.reward))return false;
  ensureGroveWallet(s);wallet.owned=wallet.owned.filter(id=>id!==tx.reward);
  if(wallet.selected===tx.reward)wallet.selected=null;
  for(const slot of Object.keys(wallet.equipped))if(wallet.equipped[slot]===tx.reward)delete wallet.equipped[slot];
 }
 tx.undone=true;wallet.balance-=tx.amount;
 wallet.transactions.push({id:'undo:'+transactionId,type:'refund',reward:tx.reward,project:tx.project,piece:tx.piece,amount:-tx.amount,at:now});
 wallet.transactions=wallet.transactions.slice(-100);return true;
}
function selectGroveDecoration(s,id){
 if(!s.groveRewards)return false;
 if(id!==null&&!s.groveRewards.owned.includes(id))return false;
 const wallet=ensureGroveWallet(s);
 if(id===null){wallet.equipped={};wallet.selected=null;return true;}
 const reward=GROVE_REWARD_CATALOG.find(r=>r.id===id);if(!reward)return false;
 wallet.equipped[reward.slot]=id;wallet.selected=id;return true;
}
function clearGroveSlot(s,slot){
 if(!Object.hasOwn(GROVE_SLOTS,slot)||!s.groveRewards)return false;
 const wallet=ensureGroveWallet(s),id=wallet.equipped[slot];delete wallet.equipped[slot];
 if(wallet.selected===id)wallet.selected=null;return true;
}
function buildGroveProject(s,id,now=Date.now(),catalog=GROVE_PROJECT_CATALOG){
 const project=catalog.find(p=>p.id===id),wallet=s.groveRewards;
 const stage=wallet?.projects?.[id]?.stage||0,piece=project?.stages[stage];
 if(!piece||!wallet||!Number.isInteger(piece.cost)||piece.cost<0||wallet.balance<piece.cost)return false;
 ensureGroveWallet(s);wallet.balance-=piece.cost;
 wallet.projects[id]={stage:stage+1,visible:true};
 wallet.transactions.push({id:'build:'+id+':'+now,type:'build',project:id,piece:piece.name,stage:stage+1,amount:-piece.cost,at:now});
 wallet.transactions=wallet.transactions.slice(-100);return true;
}
function setGroveProjectVisible(s,id,visible){
 const project=s.groveRewards?.projects?.[id];if(!project?.stage)return false;
 project.visible=!!visible;return true;
}
function pinGroveGoal(s,id){
 if(id===null){ensureGroveWallet(s).goal=null;return true;}
 const reward=GROVE_REWARD_CATALOG.find(r=>r.id===id),project=GROVE_PROJECT_CATALOG.find(p=>'project:'+p.id===id);
 if(!(reward&&!groveWallet(s).owned.includes(id))&&!(project&&(groveWallet(s).projects?.[project.id]?.stage||0)<project.stages.length))return false;
 ensureGroveWallet(s).goal=id;return true;
}
function groveGoalStatus(s){
 const wallet=groveWallet(s),reward=GROVE_REWARD_CATALOG.find(r=>r.id===wallet.goal&&!wallet.owned.includes(r.id));
 let result=reward;
 if(!result){const project=GROVE_PROJECT_CATALOG.find(p=>'project:'+p.id===wallet.goal),piece=project?.stages[wallet.projects?.[project.id]?.stage||0];if(piece)result={...piece,id:wallet.goal,icon:project.icon,name:project.name+' · '+piece.name};}
 return result?{...result,remaining:Math.max(0,result.cost-wallet.balance)}:null;
}
function groveZooFriends(s,animals,threshold=5){
 const count=Object.values(s.pts||{}).filter(n=>n>=threshold).length;
 return animals.slice(0,count);
}
function selectGroveZooVisitor(s,index,animals,threshold=5){
 if(!Number.isInteger(index)||index<0||index>=groveZooFriends(s,animals,threshold).length)return false;
 ensureGroveWallet(s).equipped.visitors='zoo:'+index;return true;
}
function refreshGroveCollections(s,now=Date.now()){
 const wallet=ensureGroveWallet(s);
 for(const slot of Object.keys(GROVE_SLOTS)){
  const items=GROVE_REWARD_CATALOG.filter(r=>r.slot===slot);
  if(items.every(r=>wallet.owned.includes(r.id)))wallet.collections[slot] ||= now;
 }
 if(GROVE_REWARD_CATALOG.every(r=>wallet.owned.includes(r.id)))wallet.collections.grove ||= now;
}
// Self-reported writing celebrates effort; it does not supply assessed skill evidence.
function completeWritingSentence(s,ideaId,now=Date.now(),policy=REWARD_POLICY){
 if(typeof ideaId!=='string'||!ideaId)return 0;
 const wallet=ensureGroveWallet(s);
 wallet.sentenceClaims ||= [];
 if(wallet.sentenceClaims.includes(ideaId))return 0;
 wallet.sentenceClaims.push(ideaId);wallet.sentenceClaims=wallet.sentenceClaims.slice(-100);
 wallet.writingSentences=(wallet.writingSentences||0)+1;
 const amount=policy.fruitPerSentence;
 wallet.balance+=amount;
 wallet.transactions.push({id:'sentence:'+ideaId,type:'earn',source:'writing-sentence',amount,at:now,policy:policy.version});
 wallet.transactions=wallet.transactions.slice(-100);return amount;
}
