let ACTIVE_REVIEW=null;
function beginReview(c,mode){feedbackQuestion={card:c,mode};ACTIVE_REVIEW={c,mode,done:false,help:false};}
function finishReview(outcome){
 const r=ACTIVE_REVIEW;if(!r||r.done)return false;r.done=true;
 recordSkill(S,r.c.c,r.mode,outcome);
 if(SESS){const key=SESS.cram?'cram':'rs';if(S.cfg[key])S.cfg[key].i=SESS.i;}
 save();return true;
}
function skipReview(){finishReview(ACTIVE_REVIEW?.missed?'miss':'skip');}
function saveRound(){
 const key=SESS.cram?'cram':'rs';
 S.cfg[key]={q:SESS.q.map(([m,c])=>[m,c.c]),i:SESS.i,t:SESS.t,p:SESS.pool.map(c=>c.c),mode:CRAM?.mode};save();
}
function resumeCram(){
 const r=S.cfg.cram;if(!r||r.i>=r.q.length)return showCram();
 const by=new Map(ALL.map(c=>[c.c,c]));
 if(!r.q.every(([m,c])=>['trace','listen','flip','memory','dictation'].includes(m)&&by.has(c)))return showCram();
 const pool=r.p.map(c=>by.get(c)).filter(Boolean);CRAM={mode:r.mode||'mixed',pool};
 SESS={cram:true,q:r.q.map(([m,c])=>[m,by.get(c)]),i:r.i,t:r.t,pool};nextItem();
}
function kidProgress(){if(Number(GR())>=3)parentDashboard(PR.cur,GR(),'',true)}
function parentDashboard(id=PR.cur,grade=GR(),unit='',childView=false){
 if(childView)id=PR.cur;
 $('gov')?.remove();screen();ACTIVE_REVIEW=null;
 const p=PR.list.find(p=>p.id===id)||prof();
 const s=p.id===PR.cur?S:JSON.parse(localStorage.getItem('zh_p_'+p.id)||'null')||blank();
 const units=QU(grade),chars=[...new Set(unit?[...unit]:units.flatMap(([,cs])=>[...cs]))];
 const days=Object.entries(s.learning?.days||{}).filter(([date])=>new Date(date).getTime()>=Date.now()-7*REVIEW_DAY).map(([,d])=>d);
 const total=days.reduce((n,d)=>n+d.attempts-d.skip,0),correct=days.reduce((n,d)=>n+d.correct,0);
 const now=Date.now(),stages=chars.map(c=>characterStage(s,c,now));
 const due=chars.filter(c=>Object.values(s.learning?.chars?.[c]?.skills||{}).some(r=>r.due<=now)).length;
 const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 A.innerHTML=`<h1>${childView?'My progress':'Parent dashboard'}</h1>${childView?'<p class="reading-note">See what you remember and what to practice next. Mastered means remembering on several different days. A review is a chance to make it stick!</p>':'<p class="reading-note">Progress stored in this browser. Stars are rewards. Mastery requires at least three spaced successes in listening and writing recall, plus pinyin for characters first introduced in Grade 2 or later. K/Grade 1 characters do not require pinyin, even for older learners. Grade 2–5 daily practice and mixed cram include Hear, Write &amp; Pinyin questions; the standalone quiz is also available. Writing quiz and flip-card ratings are self-reported.</p>'}
 ${childView?'':`<label>Child <select id="dash-child">${PR.list.map(x=>`<option value="${esc(x.id)}" ${x.id===p.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`}
 <label>Grade <select id="dash-grade">${['K','1','2','3','4','5'].map(g=>`<option ${g===grade?'selected':''}>${g}</option>`).join('')}</select></label>
 <label>Unit <select id="dash-unit"><option value="">All units</option>${units.map(([n,c])=>`<option value="${c}" ${unit===c?'selected':''}>Unit ${n}</option>`).join('')}</select></label>
 <p class="mean">Last 7 days, all units: ${correct} ${childView?'successes':'independent successes'} / ${total} ${childView?'tries':'graded attempts'}</p><p class="mean">${chars.length} characters · ${stages.filter(x=>x==='Mastered').length} mastered · ${due} due for review</p>
 ${childView?'<p class="reading-note">Stars celebrate your practice. Mastery shows what you remember over time. Come back to the characters marked for review!</p>':'<p class="reading-note">Earlier stars are shown as “Previously practiced”: detailed learning history starts with this update. Hints and mistakes bring a skill back for review in 10 minutes. Successful scheduled reviews progress through 1, 3, 7, 14, 30 and 60 elapsed days, not sessions. Extra sessions still record practice, but only a correct answer when due advances the interval (at most once per calendar day).</p>'}
 <div style="text-align:left">${!unit?units.map(([n,cs])=>`<p>Unit ${n}: ${[...cs].filter(c=>characterStage(s,c,now)==='Mastered').length} / ${[...cs].length} mastered</p>`).join(''):''}${chars.map(c=>{const skills=s.learning?.chars?.[c]?.skills||{};return `<details style="background:white;padding:12px;margin:8px 0;border-radius:12px"><summary><b style="font-size:28px">${c}</b> · ${characterStage(s,c,now)}</summary>${Object.entries(skills).map(([m,r])=>`<p>${({trace:'Trace (guided)',listen:'Listen & Tap',flip:'Flip (self-rated)',memory:'Memory',writing:'Writing (self-rated)',pinyin:'Pinyin'})[m]||esc(m)}: ${r.correct} independent / ${r.attempts-r.skips} graded · ${r.assisted} helped · ${r.misses||0} missed · ${r.skips} skipped<br>Review: ${r.due<=now?'Due now':new Date(r.due).toLocaleString()}</p>`).join('')||'<p>No detailed reviews yet.</p>'}</details>`}).join('')}</div>`;
 A.querySelectorAll('select').forEach(el=>el.style.cssText='font-size:18px;min-height:44px;margin:8px;max-width:90%;border:2px solid #ddd;border-radius:8px;background:white');
 const refresh=()=>parentDashboard(childView?PR.cur:$('dash-child').value,$('dash-grade').value,$('dash-unit').value,childView);
 if(!childView)$('dash-child').onchange=()=>parentDashboard($('dash-child').value,PR.list.find(x=>x.id===$('dash-child').value).gr||'K');
 $('dash-grade').onchange=()=>parentDashboard(p.id,$('dash-grade').value,'',childView);
 $('dash-unit').onchange=refresh;
}

function resumeCramDict(){
 const r=S.cfg.cramDict;if(!r)return showCram();
 const by=new Map(ALL.map(c=>[c.c,c]));
 CRAM={mode:'dictation',pool:r.pool.map(c=>by.get(c)).filter(Boolean)};
 DQL=CRAM.pool.map(c=>c.c).join('');SESS=null;DQ={...r,q:r.q.map(c=>by.get(c)).filter(Boolean)};dictItem();
}
