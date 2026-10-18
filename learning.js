// Additive learning evidence: rewards and legacy backups remain untouched.
const REVIEW_DAY=86400000, REVIEW_GAPS=[0,1,3,7,14,30,60];
function skillState(s,c,m){return s.learning?.chars?.[c]?.skills?.[m]||{attempts:0,correct:0,assisted:0,skips:0,level:0,due:0};}
function recordSkill(s,c,m,outcome,now=Date.now()){
 const l=s.learning ||= {version:1,chars:{},days:{}};
 const entry=l.chars[c] ||= {skills:{}};
 const r=entry.skills[m] ||= {...skillState(s,c,m)};
 r.attempts++;r[outcome==='correct'?'correct':outcome==='assisted'?'assisted':outcome==='skip'?'skips':'misses']=(r[outcome==='correct'?'correct':outcome==='assisted'?'assisted':outcome==='skip'?'skips':'misses']||0)+1;
 const date=t=>new Date(t).toLocaleDateString('en-CA');
 if(outcome==='correct'){
  if((!r.lastAdvance||date(r.lastAdvance)!==date(now))&&now>=r.due){r.level=Math.min(6,r.level+1);r.lastAdvance=now;r.due=now+REVIEW_GAPS[r.level]*REVIEW_DAY;}
 }else if(outcome!=='skip'){r.level=0;r.due=now+600000;}else if(r.due<=now){r.due=now+600000;}
 r.lastReview=now;
 const d=l.days[date(now)] ||= {attempts:0,correct:0,assisted:0,miss:0,skip:0};d.attempts++;d[outcome]++;
 Object.keys(l.days).sort().slice(0,-90).forEach(k=>delete l.days[k]);
 return r;
}
// Use the earliest official unit containing the character, independent of the learner.
// Supplemental characters fall back to the character catalog's grade membership.
function characterNeedsPinyin(c){
 for(const grade of ['K','1','2','3','4','5']){
  if(QU(grade).some(([,chars])=>chars.includes(c)))return Number(grade)>=2;
 }
 const grades=ALL.find(card=>card.c===c)?.g||'';
 return !/[K1]/.test(grades)&&/[2-5]/.test(grades);
}
function traceOutcome(mistakes,help){return mistakes<=2&&!help?'correct':'assisted';}
function characterStage(s,c,now=Date.now()){
 const skills=s.learning?.chars?.[c]?.skills;
 if(!skills)return s.pts?.[c]?'Previously practiced':'New';
 const listen=skills.listen,recall=skills.memory?.level>=3?skills.memory:skills.writing;
 const required=[listen,recall];if(characterNeedsPinyin(c))required.push(skills.pinyin);
 if(required.every(r=>r?.level>=3))return required.some(r=>r.due<=now)?'Review due':'Mastered';
 return Object.values(skills).some(r=>r.level>=2)?'Reviewing':'Learning';
}
function cramQueue(pool,modes,limit=30,mix=a=>a){
 const lists=modes.map(m=>mix(pool.slice()).map(c=>[m,c])),q=[];
 for(let i=0;q.length<limit&&i<pool.length;i++)for(const list of mix(lists.slice())){if(q.length<limit)q.push(list[i]);}
 return mix(q);
}
function progressiveQueue(s,pool,limit=10,kindergarten=false,now=Date.now(),mix=a=>a,includeDictation=false){
 const q=[],newCards=[],old=[];
 for(const c of mix(pool.slice())){
  const skills=s.learning?.chars?.[c.c]?.skills;
  if(!skills){if(newCards.length<3)newCards.push(c);continue;}
  for(const [m,r] of Object.entries(skills))if(['trace','listen','flip','memory'].includes(m)&&r.due<=now)old.push([m,c,r]);
  if(includeDictation){
   const due=['pinyin','writing'].map(m=>skills[m]).filter(r=>r&&r.due<=now);
   if(due.length||!skills.pinyin||!skills.writing)old.push(['dictation',c,{due:due.length?Math.min(...due.map(r=>r.due)):now,level:0}]);
  }
  const next=!skills.trace?'trace':!skills.listen?'listen':!skills.flip?'flip':!skills.memory?'memory':null;
  if(next)old.push([next,c,{due:now,level:0}]);
 }
 old.sort((a,b)=>a[2].due-b[2].due||a[2].level-b[2].level);
 q.push(...old.slice(0,limit).map(([m,c])=>[m,c]));
 // Reserve room for one combined review even when other overdue skills fill the session.
 const dict=old.find(([m])=>m==='dictation');
 if(includeDictation&&dict&&!q.some(([m])=>m==='dictation')){if(q.length>=limit)q.pop();q.push(dict.slice(0,2));}
 for(const c of newCards)for(const m of (includeDictation?['trace','listen','dictation','flip']:['trace','listen','flip']))if(q.length<limit)q.push([m,c]);
 if(!q.length&&pool.length)q.push(...cramQueue(pool,includeDictation?['listen','memory','dictation']:['listen','memory'],limit,mix));
 return q;
}
function reviewPriority(s,c,mode,now=Date.now()){
 const r=skillState(s,c,mode);
 return !r.attempts?1:r.due<=now?0:2;
}
function reviewPick(s,pool,mode){return pool.slice().sort((a,b)=>{
 const x=skillState(s,a.c,mode),y=skillState(s,b.c,mode);
 return reviewPriority(s,a.c,mode)-reviewPriority(s,b.c,mode)||x.due-y.due||x.level-y.level||Math.random()-.5;
})[0];}

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
  {id:'ribbon_collector',icon:'🎗️',name:'Ribbon collector',value:Math.floor(steps/10),target:10,description:'Earn 10 practice ribbons'}
 ];
 if(Number(grade)>=2)challenges.push({id:'pinyin',icon:'拼',name:'Pinyin builder',value:chars.reduce((n,c)=>n+(c.skills.pinyin?.correct||0),0),target:10,description:'Get 10 pinyin answers right'});
 return challenges;
}
function refreshRewardState(s,grade,now=Date.now()){
 const rewards=s.rewards ||= {version:1,characters:{},ribbons:0};
 const earned=[],steps=practiceSteps(s),ribbons=Math.floor(steps/10);
 if(ribbons>rewards.ribbons){rewards.ribbons=ribbons;earned.push({kind:'ribbon',count:ribbons});}
 for(const char of Object.keys(s.learning?.chars||{})){
  const evidence=rewardSkills(grade,char).map(skill=>rewardEvidence(s,char,skill));
  let tier=evidence.every(r=>r.correct>=2)?1:0;
  if(tier&&evidence.every(r=>r.level>=2))tier=2;
  if(tier&&evidence.every(r=>r.level>=3))tier=3;
  const previous=rewards.characters[char]?.tier||0;
  if(tier>previous){rewards.characters[char]={tier,earnedAt:now,firstEarnedAt:rewards.characters[char]?.firstEarnedAt||now};earned.push({kind:'character',char,tier});}
 }
 rewards.achievements ||= {};
 for(const challenge of rewardChallenges(s,grade)){
  if(challenge.value>=challenge.target&&!rewards.achievements[challenge.id]){rewards.achievements[challenge.id]=now;earned.push({kind:'challenge',icon:challenge.icon,name:challenge.name});}
 }
 return earned;
}
