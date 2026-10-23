let ACTIVE_REVIEW=null;
function beginReview(c,mode){feedbackQuestion={card:c,mode};renderRewards();ACTIVE_REVIEW={c,mode,done:false,help:false};}
function finishReview(outcome){
 const r=ACTIVE_REVIEW;if(!r||r.done)return false;r.done=true;
 if(SESS?.study)outcome=studyOutcome(outcome);
 recordSkill(S,r.c.c,r.mode,outcome);
 if(SESS?.study)recordStudyAnswer(r,outcome);
 else if(SESS){const key=SESS.cram?'cram':'rs';if(S.cfg[key])S.cfg[key].i=SESS.i;}
 save();return true;
}
function skipReview(){finishReview(ACTIVE_REVIEW?.missed?'miss':'skip');}
function saveRound(){
 if(SESS?.study)return saveStudyRound();
 const key=SESS.cram?'cram':'rs';
 S.cfg[key]={q:SESS.q.map(([m,c])=>[m,c.c]),i:SESS.i,t:SESS.t,p:SESS.pool.map(c=>c.c),mode:CRAM?.mode};save();
}
function resumeCram(){
 if(!resumeLegacyRound('cram'))return showStudySetup('review');
 const r=S.cfg.cram;if(!r||r.i>=r.q.length)return showCram();
 const by=new Map(ALL.map(c=>[c.c,c]));
 if(!r.q.every(([m,c])=>['trace','listen','flip','memory','dictation'].includes(m)&&by.has(c)))return showCram();
 const pool=r.p.map(c=>by.get(c)).filter(Boolean);CRAM={mode:r.mode||'mixed',pool};
 SESS={cram:true,q:r.q.map(([m,c])=>[m,by.get(c)]),i:r.i,t:r.t,pool};nextItem();
}
function kidProgress(){parentDashboard(PR.cur,GR(),'',true)}
function parentDashboard(id=PR.cur,grade=GR(),unit='',childView=false){
 if(childView)id=PR.cur;
 $('gov')?.remove();screen();SESS=null;CRAM=null;delete document.body.dataset.study;
 const p=PR.list.find(p=>p.id===id)||prof();if(!p)return;
 const s=p.id===PR.cur?S:JSON.parse(localStorage.getItem('zh_p_'+p.id)||'null')||blank();
 const units=QU(grade),chars=[...new Set(unit?[...unit]:units.flatMap(([,cs])=>[...cs]))],excluded=new Set(s.cfg.notLearned||[]);
 const days=Object.entries(s.learning?.days||{}).filter(([date])=>new Date(date).getTime()>=Date.now()-7*REVIEW_DAY).map(([,d])=>d);
 const total=days.reduce((n,d)=>n+Math.max(0,(d.attempts||0)-(d.skip||0)),0),correct=days.reduce((n,d)=>n+(d.correct||0),0),now=Date.now();
 const stages=chars.map(c=>characterStage(s,c,now));
 const due=chars.filter(c=>!excluded.has(c)&&Object.values(s.learning?.chars?.[c]?.skills||{}).some(r=>r.attempts>(r.skips||0)&&Number.isFinite(r.due)&&r.due<=now));
 const modes=[...CRAM_MODES.filter(([m])=>m!=='dictation'||Number(p.gr||'2')>=2).map(([m])=>m),'words'];
 const needs=MandarinMistakes.queryRecentMistakes(s,{catalog:ALL,characters:chars,activities:modes,excluded:[...excluded],limit:30});
 const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const current=p.id===PR.cur,scope=(GN[grade]||grade)+' · '+(unit?'Unit '+(units.find(([,cs])=>cs===unit)?.[0]||'selection'):'All units');
 const details=chars.map(c=>{const skills=s.learning?.chars?.[c]?.skills||{};return `<details class="progress-character"><summary><b lang="zh-Hans">${c}</b> · ${characterStage(s,c,now)}</summary>${Object.entries(skills).map(([m,r])=>`<p>${({trace:'Trace (guided)',listen:'Listen & Tap',flip:'Flip (self-rated)',memory:'Memory',writing:'Writing (self-rated)',pinyin:'Pinyin',words:'Build words (dictionary checked)'})[m]||esc(m)}: ${r.correct} independent / ${r.attempts-r.skips} graded · ${r.assisted} helped · ${r.misses||0} missed · ${r.skips} skipped<br>Review: ${r.due<=now?'Due now':new Date(r.due).toLocaleString()}</p>`).join('')||'<p>No detailed reviews yet.</p>'}</details>`;}).join('');
 A.innerHTML=`<section class="progress-page"><h1>${childView?'My progress':'Parent dashboard'}</h1>
 <section class="progress-next" id="progress-next"><h2>${childView?'Your next step':esc(p.name)+"’s next step"}</h2><p>${total?`Last 7 days: ${total} skill ${total===1?'try':'tries'} · ${correct} ${correct===1?'success':'successes'}`:'No graded skill tries in the last 7 days. Start a little practice today.'}</p><p class="reading-note">${esc(scope)} · saved practice needs exclude characters set aside.</p><div class="progress-metrics"><span><b>${needs.needs.length}</b> ${needs.needs.length===1?'thing':'things'} to practice</span><span><b>${due.length}</b> scheduled for review</span><span><b>${stages.filter(x=>x==='Mastered').length}</b> mastered</span></div>
 <p class="reading-note">Things to practice come from recent saved first attempts. Scheduled reviews follow the learning calendar. Stars and badges celebrate effort.</p>
 ${current?`<button class="btn" id="dash-needs">${needs.needs.length?'Practice these again':'Choose a Review round'}</button>${due.length?'<button class="btn gray" id="dash-due">Review scheduled characters</button>':''}`:'<p>Choose this learner in the profile menu to start their practice.</p><button class="btn" id="dash-switch">Switch learner</button>'}</section>
 <div class="progress-filters">${childView?'':`<label>Child <select id="dash-child">${PR.list.map(x=>`<option value="${esc(x.id)}" ${x.id===p.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`}<label>Grade <select id="dash-grade">${['K','1','2','3','4','5'].map(g=>`<option ${g===grade?'selected':''}>${g}</option>`).join('')}</select></label><label>Unit <select id="dash-unit"><option value="">All units</option>${units.map(([n,c])=>`<option value="${c}" ${unit===c?'selected':''}>Unit ${n}</option>`).join('')}</select></label></div>
 <details id="progress-details"><summary>Unit and character details · ${chars.length} characters</summary>${!unit?units.map(([n,cs])=>`<p>Unit ${n}: ${[...cs].filter(c=>characterStage(s,c,now)==='Mastered').length} / ${[...cs].length} mastered</p>`).join(''):''}${details}</details>
 <details id="progress-rules"><summary>How progress works</summary><p>Weekly totals include checked and self-rated skill tries. Listen &amp; Write counts pinyin and self-rated writing separately. Looking up words and ungraded answers do not create assessed success.</p><p>Recent practice needs use the last 20 completed rounds and keep original first scores. A later successful assessment can mark an item practiced again. The Review list shows the details and the question limit.</p><p>Mastery requires at least three spaced successes in listening and writing recall, plus pinyin for characters first introduced in Grade 2 or later. K/Grade 1 characters do not require pinyin, even for older learners. Writing and flip-card ratings are self-reported.</p><p>Earlier stars remain “Previously practiced” when detailed learning evidence is missing. Hints and mistakes schedule a skill for review in 10 minutes. Correct scheduled reviews advance through 1, 3, 7, 14, 30 and 60 elapsed days, at most once per calendar day. Extra practice is still recorded. Rewards and detailed evidence stay separate.</p></details>${childView?`<details id="progress-characters"><summary>My characters · Browse units and practice</summary>${groveCharactersMarkup()}</details>`:''}</section>`;
 if(childView)homeSets();
 const refresh=()=>parentDashboard(childView?PR.cur:$('dash-child').value,$('dash-grade').value,$('dash-unit').value,childView);
 if(!childView)$('dash-child').onchange=()=>parentDashboard($('dash-child').value,PR.list.find(x=>x.id===$('dash-child').value).gr||'K');
 $('dash-grade').onchange=()=>parentDashboard(p.id,$('dash-grade').value,'',childView);$('dash-unit').onchange=refresh;
 if(current){
  $('dash-needs').onclick=()=>{const pool=chars.map(c=>ALL.find(x=>x.c===c)).filter(Boolean);showStudySetup('review',pool);if(needs.needs.length){STUDY_DRAFT.config.modes=studyActivities().map(([m])=>m);updateStudyCount();showRecentMistakes();}};
  if($('dash-due'))$('dash-due').onclick=()=>showStudySetup('review',due.map(c=>ALL.find(x=>x.c===c)).filter(Boolean));
 }else $('dash-switch').onclick=who;
}

function resumeCramDict(){
 const r=S.cfg.cramDict;if(!r)return showCram();
 const excluded=new Set(S.cfg.notLearned||[]);r.q=r.q.slice(0,r.i).concat(r.q.slice(r.i).filter(c=>!excluded.has(c)));
 if(r.i>=r.q.length){delete S.cfg.cramDict;save();return showStudySetup('review');}
 const by=new Map(ALL.map(c=>[c.c,c]));
 CRAM={mode:'dictation',pool:r.pool.map(c=>by.get(c)).filter(Boolean)};
 DQL=CRAM.pool.map(c=>c.c).join('');SESS=null;DQ={...r,q:r.q.map(c=>by.get(c)).filter(Boolean)};dictItem();
}

const REWARD_NAMES=['','Character badge','Remembered again','Strong memory'];
const REWARD_ICONS=['🌱','🥉','🥈','🥇'];
function rewardTargets(char){
 return rewardSkills(GR(),char).map(skill=>{
  const n=Math.min(REWARD_POLICY.successesPerBadge,rewardEvidence(S,char,skill).correct||0);
  return `${({listen:'👂 Listen',recall:'✍️ Write',pinyin:'拼 Pinyin'})[skill]} ${n}/${REWARD_POLICY.successesPerBadge}`;
 }).join(' · ');
}
function renderRewards(){
 const strip=$('reward-strip');if(!strip)return;
 strip.hidden=!prof();if(!prof())return;
 const steps=practiceSteps(S),ribbons=S.rewards?.ribbons||0,count=Object.keys(S.rewards?.characters||{}).length;
 // Reward details belong outside the active question; never expose a recall target.
 const char=document.body.dataset.screen==='home'?feedbackQuestion?.card?.c:null;
 const tier=char?S.rewards?.characters?.[char]?.tier||0:0;
 strip.innerHTML=`<button class="reward-collection-link" onclick="rewardCollection()" aria-label="My badges"><b>🎗️ ${ribbons} · 🏅 ${count}</b><span>My badges ›</span></button><button class="reward-collection-link grove-wallet-link" onclick="showGroveRewards()" aria-label="Grove rewards"><b>🍊 ${groveWallet(S).balance}</b><span>Your grove ›</span></button><div class="reward-meter"><span class="reward-meter-caption">${steps%REWARD_POLICY.stepsPerRibbon}/${REWARD_POLICY.stepsPerRibbon} steps to your next ribbon</span><span class="reward-meter-count">${steps%REWARD_POLICY.stepsPerRibbon}/${REWARD_POLICY.stepsPerRibbon} steps</span><progress max="${REWARD_POLICY.stepsPerRibbon}" value="${steps%REWARD_POLICY.stepsPerRibbon}" aria-label="Practice steps toward next ribbon"></progress></div>${char?`<div class="reward-character"><b>${char} ${REWARD_ICONS[tier]} ${tier?REWARD_NAMES[tier]:'Build your badge'}</b><small>${tier?'Your badge stays yours. Reviews can earn upgrades!':rewardTargets(char)}</small></div>`:''}`;
}
let rewardNoticeTimer;
function announceRewards(earned){
 if(!earned.length)return;
 let notice=$('reward-notice');if(!notice){notice=document.createElement('div');notice.id='reward-notice';notice.setAttribute('role','status');document.body.append(notice);}
 notice.textContent=earned.map(e=>e.kind==='fruit'?`🍊 ${e.amount} orange${e.amount===1?'':'s'} grown!`:e.kind==='ribbon'?'🎗️ New practice ribbon!':e.kind==='challenge'?`${e.icon} ${e.name} earned!`:`${REWARD_ICONS[e.tier]} ${e.char} — ${REWARD_NAMES[e.tier]} earned!`).join(' ');
 notice.hidden=false;clearTimeout(rewardNoticeTimer);rewardNoticeTimer=setTimeout(()=>notice.hidden=true,4000);
}
function rewardCollection(){
 screen();SESS=null;CRAM=null;renderRewards();
 const entries=Object.entries(S.rewards?.characters||{}).sort((a,b)=>b[1].earnedAt-a[1].earnedAt);
 const steps=practiceSteps(S),ribbons=S.rewards?.ribbons||0;
 A.innerHTML=`<h1>My badges</h1><div class="reward-total">🎗️ ${ribbons}</div><button class="btn gray" onclick="showGroveRewards()">🍊 ${groveWallet(S).balance} oranges · Your grove</button><p class="mean">${steps} practice steps · a ribbon every 10!</p><p class="reading-note">Each graded skill is a step, even when you need another try. Listen &amp; Write counts two skills. Skips don’t count.</p><h2>Practice challenges</h2><p class="reading-note">Every challenge below can be earned through practice—no waiting for tomorrow.</p><div class="reward-grid">${rewardChallenges(S,GR()).map(c=>{const done=!!S.rewards?.achievements?.[c.id];return `<div class="reward-card"><span>${c.icon}</span><b style="font-size:20px">${c.name}</b><small>${c.description}</small><strong>${done?'✅ Earned':Math.min(c.value,c.target)+' / '+c.target}</strong><progress aria-label="${c.name} progress" max="${c.target}" value="${done?c.target:Math.min(c.value,c.target)}"></progress></div>`}).join('')}</div><h2>Character collection · ${entries.length}</h2><p class="reading-note">🥉 ${REWARD_POLICY.successesPerBadge} successes in each badge skill earn a character badge. 🥈 Remember it on a later scheduled review. 🥇 Keep remembering on spaced reviews. Your earned badges stay yours!</p>${GR()==='K'?'<p class="reading-note">Your first badges come from listening. Tracing also earns practice steps!</p>':''}<div class="reward-grid">${entries.map(([c,r])=>`<div class="reward-card"><span>${REWARD_ICONS[r.tier]}</span><b>${c}</b><small>${REWARD_NAMES[r.tier]}</small></div>`).join('')||'<p>Keep practicing to add your first character!</p>'}</div><h2>Growing next</h2><div class="reward-grid">${CARDS.filter(c=>!S.rewards?.characters?.[c.c]).slice(0,12).map(c=>`<div class="reward-card"><b>${c.c}</b><small>${rewardTargets(c.c)}</small></div>`).join('')||'<p>You earned a badge for every character in this practice set!</p>'}</div><button class="btn" onclick="home()">Back home</button>`;
}
