// Pure reward policy and state. Quiz/SRS code supplies evidence; UI consumes events.
const REWARD_POLICY=Object.freeze({version:3,stepsPerRibbon:10,successesPerBadge:2,fruitPerRibbon:1,fruitPerSentence:1,legacyStarsPerFruit:10});
const GROVE_REWARD_CATALOG=Object.freeze([
 {id:'violet-leaves',icon:'🍃',name:'Violet leaves',description:'Give your unit trees violet leaves.',cost:3},
 {id:'butterfly',icon:'🦋',name:'Butterfly visitor',description:'Invite a butterfly into your grove.',cost:4},
 {id:'sunrise',icon:'🌅',name:'Sunrise glow',description:'A warm sunrise behind your unit trees.',cost:6}
]);
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
function refreshGroveWallet(s,now=Date.now(),policy=REWARD_POLICY){
 const wallet=s.groveRewards ||= {...groveWallet(s)};
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
 const wallet=s.groveRewards ||= {...groveWallet(s)};
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
 wallet.balance-=reward.cost;wallet.owned.push(id);wallet.selected=id;
 wallet.transactions.push({id:'unlock:'+id+':'+now,type:'unlock',reward:id,amount:-reward.cost,at:now});
 wallet.transactions=wallet.transactions.slice(-100);return true;
}
function undoGroveUnlock(s,transactionId,now=Date.now()){
 const wallet=s.groveRewards,tx=wallet?.transactions.find(x=>x.id===transactionId&&x.type==='unlock'&&!x.undone);
 if(!tx||!wallet.owned.includes(tx.reward))return false;
 tx.undone=true;wallet.balance-=tx.amount;wallet.owned=wallet.owned.filter(id=>id!==tx.reward);
 if(wallet.selected===tx.reward)wallet.selected=null;
 wallet.transactions.push({id:'undo:'+transactionId,type:'refund',reward:tx.reward,amount:-tx.amount,at:now});
 wallet.transactions=wallet.transactions.slice(-100);return true;
}
function selectGroveDecoration(s,id){
 if(!s.groveRewards)return false;
 if(id!==null&&!s.groveRewards.owned.includes(id))return false;
 s.groveRewards.selected=id;return true;
}
// Self-reported writing celebrates effort; it does not supply assessed skill evidence.
function completeWritingSentence(s,ideaId,now=Date.now(),policy=REWARD_POLICY){
 if(typeof ideaId!=='string'||!ideaId)return 0;
 const wallet=s.groveRewards ||= {...groveWallet(s)};
 wallet.sentenceClaims ||= [];
 if(wallet.sentenceClaims.includes(ideaId))return 0;
 wallet.sentenceClaims.push(ideaId);wallet.sentenceClaims=wallet.sentenceClaims.slice(-100);
 wallet.writingSentences=(wallet.writingSentences||0)+1;
 const amount=policy.fruitPerSentence;
 wallet.balance+=amount;
 wallet.transactions.push({id:'sentence:'+ideaId,type:'earn',source:'writing-sentence',amount,at:now,policy:policy.version});
 wallet.transactions=wallet.transactions.slice(-100);return amount;
}
