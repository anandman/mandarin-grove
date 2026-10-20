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
// Readiness to add material is a same-day milestone, separate from spaced mastery.
function unitReadiness(s,chars,grade){
 const unique=[...new Set(chars)],target=2;
 const completed=unique.filter(c=>{
  if(skillState(s,c,'listen').correct<target)return false;
  if(grade!=='K'&&skillState(s,c,'memory').correct+skillState(s,c,'writing').correct<target)return false;
  return !(Number(grade)>=2&&characterNeedsPinyin(c))||skillState(s,c,'pinyin').correct>=target;
 }).length;
 return {ready:unique.length>0&&completed===unique.length,completed,total:unique.length};
}
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
