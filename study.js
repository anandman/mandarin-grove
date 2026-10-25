// Shared Practice/Review setup and bounded rounds. Existing skill/reward evidence is unchanged.
function studyQueue(s,pool,modes,limit,kind,mix=a=>a,now=Date.now()){
 const excluded=new Set(s.cfg?.notLearned||[]),seen=new Set();
 let cards=mix(pool.filter(c=>!excluded.has(c.c)&&!seen.has(c.c)&&seen.add(c.c)));
 if(kind==='practice'){
  let introduced=0;cards=cards.filter(c=>s.learning?.chars?.[c.c]||introduced++<3);
 }
 const lists=new Map([...new Set(modes)].map(m=>[m,mix(cards.slice())]));
 if(kind==='practice')for(const [mode,list]of lists)list.sort((a,b)=>{
  const state=c=>{const rows=(mode==='dictation'?['writing','pinyin']:[mode]).map(m=>skillState(s,c.c,m));return {priority:rows.some(r=>r.attempts&&r.due<=now)?0:rows.some(r=>!r.attempts)?1:2,due:Math.min(...rows.map(r=>r.due)),last:Math.min(...rows.map(r=>r.lastReview||0))};};
  const x=state(a),y=state(b);return x.priority-y.priority||x.due-y.due||x.last-y.last;
 });
 const q=[];let last;
 while(q.length<Math.min(30,limit)){
  let order=mix([...lists.keys()].filter(m=>lists.get(m).length));if(!order.length)break;
  if(order.length>1&&order[0]===last)order.push(order.shift());
  for(const mode of order){if(q.length>=limit)break;q.push([mode,lists.get(mode).shift()]);last=mode;}
 }
 return q;
}
function studyDefaults(s,grade,kind,fallback,allowed){
 const stored=s.cfg?.studyChoices?.[grade]?.[kind];
 return {units:[...(stored?.units||[])],chars:[...(stored?.chars||fallback)],modes:(stored?.modes||allowed.filter(m=>m!=='words')).filter(m=>allowed.includes(m)),limit:[5,10,20,30].includes(stored?.limit)?stored.limit:kind==='review'?30:10};
}
function addStudyResult(round,key,result){return GroveResults.recordFirstResult(round,key,result);}
function studyScore(round){const all=Object.values(round.results||{}),rows=all.filter(r=>!r.ungraded),correct=rows.filter(r=>r.correct).length,total=rows.length;return {total,correct,percent:total?Math.round(1000*correct/total)/10:0,reached:total>0&&correct/total>=.9,selfRated:rows.filter(r=>r.selfRated).length,...(all.length>total?{ungraded:all.length-total}:{})};}
function pruneStudyRound(round,excluded){
 const blocked=new Set(excluded),keep=(item)=>Object.hasOwn(round.results||{},item[0]+':'+item[1])||!blocked.has(item[1]);
 return {...round,q:round.q.filter(keep),cursor:round.q.slice(0,round.cursor).filter(keep).length};
}
function completeStudyRound(s,round,now=Date.now()){
 const history=s.studyHistory||=[];if(history.some(r=>r.id===round.id))return;
 history.push(JSON.parse(JSON.stringify({...round,ended:now,score:studyScore(round)})));s.studyHistory=history.slice(-20);
}
function studyActivities(){return [...CRAM_MODES.filter(([m])=>m!=='dictation'||Number(GR())>=2),['words','Build words · 组词']];}
function studyUnitChoices(){
 const units=[];for(const grade of ['K','1','2','3','4','5'])for(const [n,chars]of QU(grade))if(chars.length)units.push({id:grade+':'+n,grade,label:'Unit '+n,chars:[...chars]});
 for(const h of HSETS().o.filter(h=>h.supplemental))units.push({id:h.id,grade:h.g,label:h.t,chars:h.c});
 return units;
}
function currentStudyRound(kind){const r=S.cfg.studyRounds?.[GR()]?.[kind];return r&&r.cursor<r.q.length?r:null;}
let STUDY_DRAFT=null,STUDY_LAST=null;
function studyGoalText(total){return `90% goal: ${Math.ceil(total*.9)} of ${total} first attempt${total===1?'':'s'}`; }
function studyScopeText(config){
 const groups=new Map();for(const u of studyUnitChoices().filter(u=>(config.units||[]).includes(u.id))){if(!groups.has(u.grade))groups.set(u.grade,[]);groups.get(u.grade).push(u.label.replace('Unit ',''));}
 return [...groups].map(([grade,units])=>`${GN[grade]} · ${units.length>6?units.length+' selected units':'Unit'+(units.length===1?'':'s')+' '+units.join(', ')}`).join(' · ')||'Individually selected characters';
}
function showStudySetup(kind='practice',pool,restoredDraft=null){
 const existing=$('study-setup');if(existing?.open)return;
 const allowed=studyActivities().map(x=>x[0]),fallback=(pool||CARDS).map(c=>c.c),config=restoredDraft?JSON.parse(JSON.stringify(restoredDraft.config)):studyDefaults(S,GR(),kind,fallback,allowed);
 if(pool){config.chars=[...new Set(fallback)];config.units=[];}
 const valid=new Set(ALL.map(c=>c.c));config.chars=config.chars.filter(c=>valid.has(c));
 const units=studyUnitChoices();config.units=config.units.filter(id=>units.some(u=>u.id===id));
 if(!config.units.length)config.units=units.filter(u=>u.grade===GR()&&u.chars.every(c=>config.chars.includes(c))).map(u=>u.id);
 STUDY_DRAFT={kind,config,owner:PR.cur,excluded:new Set(restoredDraft?.excluded||S.cfg.notLearned||[]),extras:restoredDraft?.extras.slice()||config.chars.slice(),units};
 const draft=STUDY_DRAFT;
 const previous=document.activeElement,dialog=document.createElement('dialog');dialog.id='study-setup';dialog.setAttribute('aria-labelledby','study-title');
 const saved=currentStudyRound(kind);
 dialog.innerHTML=`<div class="study-setup-title"><h2 id="study-title">${kind==='review'?'Review':'Practice'}</h2><button class="study-close" aria-label="Close session choices">✕</button></div>
 <p class="study-explanation">${kind==='review'?'Check what you remember from your selection.':'Build skills with help. Due skills come first within each activity; up to 3 characters with no saved skill record per round.'}</p>
 ${saved?`<section class="study-saved"><p id="study-saved-scope">Paused · ${saved.cursor} of ${saved.q.length} finished · ${saved.config.chars.length} character${saved.config.chars.length===1?'':'s'} · ${saved.config.modes.length} activit${saved.config.modes.length===1?'y':'ies'}<br>${voiceEscape(studyScopeText(saved.config))}</p><button class="btn study-resume" id="study-continue">Continue this round</button></section>`:''}
 <section class="study-ready"><b id="study-count" role="status"></b><p id="study-scope" class="reading-note"></p><p id="study-round-goal" class="reading-note"></p><button class="btn ${saved?'gray':''}" id="study-start">Start</button></section>
 ${kind==='review'?'<button type="button" id="study-recent-mistakes" class="progress-link" onclick="showRecentMistakes()">Things to practice</button>':''}
 <details id="study-choice-editor"><summary>Change choices</summary><div class="study-settings"><section><h3>Units</h3><div class="study-unit-picker" role="region" aria-label="Choose school units">${[GR(),...['K','1','2','3','4','5'].filter(g=>g!==GR())].map(g=>`<details ${g===GR()?'open':''}><summary>${GN[g]}</summary><div>${units.filter(u=>u.grade===g).map(u=>`<label><input type="checkbox" data-study-unit="${voiceEscape(u.id)}" ${config.units.includes(u.id)?'checked':''}><span>${u.label}<small lang="zh-Hans">${u.chars.join(' ')}</small></span></label>`).join('')}</div></details>`).join('')}</div></section>
 <section><div class="study-subheading"><h3>Characters</h3><button class="progress-link" id="study-all-chars">Select all available</button></div><div class="study-characters" id="study-characters"></div><small>Leave out characters you haven’t learned yet.</small><details id="study-deferred"><summary>Not learned yet <span id="study-deferred-count"></span></summary><div id="study-deferred-list"></div></details></section>
 <section><h3>Activities</h3><div class="study-activities">${studyActivities().map(([m,label])=>`<label><input type="checkbox" data-study-mode="${m}" ${config.modes.includes(m)?'checked':''}>${label}</label>`).join('')}</div></section></div>
 <div class="study-question-limit"><label>Questions <select id="study-limit">${[5,10,20,30].map(n=>`<option ${config.limit===n?'selected':''}>${n}</option>`).join('')}</select></label><p class="reading-note">Goal: 90% of scored first attempts, including your own checks. Build words answers outside the word bank stay ungraded.</p></div></details>
 <div id="study-replace" hidden role="group" aria-label="Replace paused round"><p>A ${kind==='review'?'Review':'Practice'} round is paused. A new round replaces only that paused round. Finished history and earned progress stay saved.</p><button class="btn" id="study-confirm-replace">Replace paused round</button><button class="btn gray" id="study-keep">Keep paused round</button></div>`;
 document.body.append(dialog);dialog.showModal();
 dialog.querySelector('.study-close').onclick=closeStudySetup;
 dialog.onclose=()=>{dialog.remove();if(STUDY_DRAFT===draft)STUDY_DRAFT=null;if(previous?.isConnected)previous.focus({preventScroll:true});};
 dialog.querySelectorAll('[data-study-unit]').forEach(input=>input.onchange=()=>{
  const d=STUDY_DRAFT,u=units.find(u=>u.id===input.dataset.studyUnit);
  if(input.checked){d.config.units.push(u.id);d.config.chars=[...new Set([...d.config.chars,...u.chars])];}
  else{d.config.units=d.config.units.filter(id=>id!==u.id);const keep=new Set(units.filter(u=>d.config.units.includes(u.id)).flatMap(u=>u.chars));d.config.chars=d.config.chars.filter(c=>!u.chars.includes(c)||keep.has(c));}
  renderStudyCharacters();
 });
 dialog.querySelectorAll('[data-study-mode]').forEach(input=>input.onchange=()=>{STUDY_DRAFT.config.modes=[...dialog.querySelectorAll('[data-study-mode]:checked')].map(e=>e.dataset.studyMode);updateStudyCount();});
 $('study-limit').onchange=()=>{STUDY_DRAFT.config.limit=Number($('study-limit').value);updateStudyCount();};
 $('study-all-chars').onclick=()=>{STUDY_DRAFT.config.chars=studyDraftCharacters().filter(c=>!STUDY_DRAFT.excluded.has(c));renderStudyCharacters();};
 $('study-start').onclick=()=>{if(currentStudyRound(kind)){$('study-replace').hidden=false;$('study-keep').focus();}else startStudyDraft();};
 $('study-confirm-replace').onclick=startStudyDraft;
 $('study-keep').onclick=()=>{$('study-replace').hidden=true;($('study-continue')||$('study-start')).focus();};
 if(saved)$('study-continue').onclick=()=>{closeStudySetup();resumeStudy(kind);};
 renderStudyCharacters();
}
function closeStudySetup(){const dialog=$('study-setup');if(dialog){dialog.close();dialog.remove();}STUDY_DRAFT=null;}
function studyDraftCharacters(){const d=STUDY_DRAFT;return [...new Set([...d.units.filter(u=>d.config.units.includes(u.id)).flatMap(u=>u.chars),...d.extras,...d.config.chars])];}
function renderStudyCharacters(){
 const d=STUDY_DRAFT,chars=studyDraftCharacters();
 $('study-characters').innerHTML=chars.map(c=>`<label class="${d.excluded.has(c)?'is-deferred':''}"><input type="checkbox" data-study-char="${c}" ${d.config.chars.includes(c)&&!d.excluded.has(c)?'checked':''} ${d.excluded.has(c)?'disabled':''}><span lang="zh-Hans">${c}</span></label>`).join('')||'<p>Choose a unit above.</p>';
 $('study-characters').querySelectorAll('input').forEach(input=>input.onchange=()=>{const c=input.dataset.studyChar;d.config.chars=input.checked?[...new Set([...d.config.chars,c])]:d.config.chars.filter(x=>x!==c);updateStudyCount();});
 $('study-deferred-count').textContent=d.excluded.size?'('+d.excluded.size+')':'';
 $('study-deferred-list').innerHTML=[...d.excluded].map(c=>`<button class="btn gray" data-study-restore="${voiceEscape(c)}">Add ${voiceEscape(c)}</button>`).join('')||'<p>No characters set aside.</p>';
 $('study-deferred-list').querySelectorAll('button').forEach(button=>button.onclick=()=>{const c=button.dataset.studyRestore;d.excluded.delete(c);d.config.chars=[...new Set([...d.config.chars,c])];renderStudyCharacters();[...$('study-characters').querySelectorAll('input')].find(input=>input.dataset.studyChar===c)?.focus();});updateStudyCount();
}
function studyDraftPool(){return ALL.filter(c=>STUDY_DRAFT.config.chars.includes(c.c)&&!STUDY_DRAFT.excluded.has(c.c));}
function updateStudyCount(){
 const d=STUDY_DRAFT,pool=studyDraftPool(),count=d.config.modes.length?studyQueue({...S,cfg:{...S.cfg,notLearned:[...d.excluded]}},pool,d.config.modes,d.config.limit,d.kind,a=>a).length:0;
 $('study-count').textContent=`${pool.length} character${pool.length===1?'':'s'} · ${d.config.modes.length} activit${d.config.modes.length===1?'y':'ies'}`;
 $('study-scope').textContent=studyScopeText(d.config)+'\n'+studyActivities().filter(([mode])=>d.config.modes.includes(mode)).map(([,label])=>label).join(' · ');$('study-round-goal').textContent=count?`${count} question${count===1?'':'s'} · ${studyGoalText(count)}. Build words answers outside the word bank do not count toward the goal.`:'Choose characters and at least one activity.';
 const b=$('study-start');b.disabled=!count;b.textContent=(currentStudyRound(d.kind)?'Start a new round':'Start')+(count?' · '+count+' question'+(count===1?'':'s'):'');
 const recent=$('study-recent-mistakes');if(recent)recent.textContent='Things to practice · '+recentMistakeCount();
}
function startStudyDraft(){
 const d=STUDY_DRAFT;if(!d||d.owner!==PR.cur){closeStudySetup();return;}const pool=studyDraftPool();if(!pool.length||!d.config.modes.length)return;
 const kind=d.kind,config=JSON.parse(JSON.stringify(d.config));S.cfg.notLearned=[...d.excluded];
 ((S.cfg.studyChoices||={})[GR()]||={})[kind]=JSON.parse(JSON.stringify(config));save();closeStudySetup();startStudyRound(kind,config,pool);
}
function startStudyRound(kind,config,pool,queue){
 stopSpeech();NAV++;lq=[];mq=[];TH=[];TF=[];
 const q=queue||studyQueue(S,pool,config.modes,config.limit,kind,shuffle);
 if(!q.length){showStudySetup(kind,pool);return;}
 const round={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),kind,config:JSON.parse(JSON.stringify(config)),q:q.map(([m,c])=>[m,c.c]),cursor:0,results:{}};
 runStudyRound(round,pool);
}
function runStudyRound(round,pool){
 const by=new Map(ALL.map(c=>[c.c,c]));round=pruneStudyRound(round,S.cfg.notLearned||[]);
 const q=round.q.filter(([m,c])=>studyActivities().some(([mode])=>m===mode)&&by.has(c)).map(([m,c])=>[m,by.get(c)]);
 if(q.length!==round.q.length){showStudySetup(round.kind);return;}
 CRAM={mode:'study',pool:pool||round.config.chars.map(c=>by.get(c)).filter(Boolean)};
 SESS={study:true,cram:round.kind==='review',kind:round.kind,round,q,i:round.cursor,pool:CRAM.pool};nextItem();
}
function resumeStudy(kind){const r=currentStudyRound(kind);if(r)runStudyRound(JSON.parse(JSON.stringify(r)));else showStudySetup(kind);}
function saveStudyRound({persist=true}={}){
 const r=SESS.round;r.q=SESS.q.map(([m,c])=>[m,c.c]);
 ((S.cfg.studyRounds||={})[GR()]||={})[SESS.kind]=JSON.parse(JSON.stringify(r));if(persist)save();
}
function recordStudyAnswer(review,outcome,{persist=true}={}){
 if(!SESS?.study)return;
 const [mode,c]=SESS.q[SESS.currentIndex],r=SESS.round;
 const before=persist?JSON.parse(JSON.stringify(r)):null,deferred=A.querySelector('.study-not-learned'),wasDisabled=deferred?.disabled;
 const itemId=mode+':'+c.c;
 const result=GroveResults.createResult({character:c.c,mode,sessionId:r.id,itemId,correct:outcome==='correct',outcome,...(outcome==='unverified'?{ungraded:true}:{}),selfRated:mode==='flip'||mode==='dictation',...(review?.evidence?{evidence:review.evidence}:{})},{makeId:()=>r.id+':'+itemId});
 try{addStudyResult(r,itemId,result);
 r.cursor=SESS.i;if(r.cursor>=r.q.length)completeStudyRound(S,r);deferred?.setAttribute('disabled','');saveStudyRound({persist});}
 catch(error){if(before)SESS.round=before;if(deferred)deferred.disabled=wasDisabled;throw error;}
}
function studyNextItem(){
 if(SESS.i>=SESS.q.length){finishStudyRound();return;}
 const index=SESS.i,previous={i:SESS.i,currentIndex:SESS.currentIndex,cursor:SESS.round.cursor};SESS.currentIndex=index;SESS.round.cursor=index;SESS.i++;
 try{saveStudyRound();}catch(error){SESS.i=previous.i;SESS.currentIndex=previous.currentIndex;SESS.round.cursor=previous.cursor;throw error;}
 const [mode,c]=SESS.q[index];({listen,trace:()=>trace(practiceCards().indexOf(c)),flip,memory,dictation:dictQuestion,words:wordStudyQuestion})[mode](c);
 document.body.dataset.study=SESS.kind;
 if(mode==='dictation')A.querySelector('.grove-activity-heading').insertAdjacentHTML('afterend',studySessionBar());
}
function studySessionBar(){
 if(!SESS?.study)return '';
 const characterCount=SESS.pool.filter(c=>!(S.cfg.notLearned||[]).includes(c.c)).length;
 return `<div class="study-sessionbar"><span><b>${SESS.kind==='review'?'Review':'Practice'} · ${SESS.i}/${SESS.q.length}</b><small>${characterCount} character${characterCount===1?'':'s'} · ${SESS.round.config.modes.length} activit${SESS.round.config.modes.length===1?'y':'ies'} · ${studyGoalText(SESS.q.length)}</small></span><button onclick="showStudySetup('${SESS.kind}')">Change</button><button onclick="pauseStudy()">Pause</button></div><button class="study-not-learned" onclick="studyNotLearned()">I haven’t learned this yet</button>`;
}
function pauseStudy(){if(SESS?.study){if(SESS.round.cursor>=SESS.q.length){finishStudyRound();return;}saveStudyRound();}home();}
function studyNotLearned(){return ActivityUI.run(()=>{
 if(!SESS?.study)return;const item=SESS.q[SESS.currentIndex],c=item?.[1];if(!c||Object.hasOwn(SESS.round.results,item[0]+':'+c.c))return;
 const previous={q:SESS.q.slice(),i:SESS.i,round:JSON.parse(JSON.stringify(SESS.round)),review:ACTIVE_REVIEW};
 S.cfg.notLearned=[...new Set([...(S.cfg.notLearned||[]),c.c])];
 const before=SESS.q.slice(0,SESS.currentIndex),after=SESS.q.slice(SESS.currentIndex+1).filter(([,x])=>x.c!==c.c);
 SESS.q=before.concat(after);SESS.i=before.length;SESS.round.cursor=SESS.i;
 try{saveStudyRound();}catch(error){SESS.q=previous.q;SESS.i=previous.i;SESS.round=previous.round;ACTIVE_REVIEW=previous.review;throw error;}
 ACTIVE_REVIEW=null;NAV++;stopSpeech();nextItem();
});}
function finishStudyRound(){
 const round=SESS.round;round.cursor=round.q.length;completeStudyRound(S,round);saveStudyRound();STUDY_LAST=JSON.parse(JSON.stringify(round));
 const score=studyScore(round),misses=Object.entries(round.results).filter(([,r])=>!r.correct&&!r.ungraded);
 SESS=null;CRAM=null;delete document.body.dataset.study;screen();
 A.innerHTML=`<section class="study-finish"><h1>${score.reached?'Goal reached!':'Round finished!'}</h1><p class="reading-note">${round.q.length} question${round.q.length===1?'':'s'} finished. Your work is saved.</p><p class="study-score">${score.correct} / ${score.total}</p><p>${score.total?score.percent+'% round score · '+studyGoalText(score.total):'No scored answers this round'}</p>${score.ungraded?`<p>${score.ungraded} answer${score.ungraded===1?'':'s'} not checked by the app · left out of the score and Things to practice.</p>`:''}<p class="reading-note">First attempts${score.selfRated?' · '+score.selfRated+' answer'+(score.selfRated===1?'':'s')+' include'+(score.selfRated===1?'s':'')+' your own check. Self-checks count toward this score':''}. Your practice and rewards are saved.</p>${misses.length?`<details class="study-mistakes"><summary>Things to practice · ${misses.length}</summary><ul>${misses.map(([,r])=>`<li><b lang="zh-Hans">${r.character}</b> · ${studyActivities().find(([m])=>m===r.mode)?.[1]||r.mode}</li>`).join('')}</ul></details><button class="btn" onclick="retryStudyMisses()">Practice these again</button>`:''}<button class="btn gray" onclick="home()">Finish</button><button class="progress-link" onclick="showStudySetup('${round.kind}')">Choose another round</button></section>`;
}
function retryStudyMisses(){
 if(!STUDY_LAST)return;const r=STUDY_LAST,by=new Map(ALL.map(c=>[c.c,c])),q=Object.values(r.results).filter(x=>!x.correct&&!x.ungraded&&!(S.cfg.notLearned||[]).includes(x.character)).map(x=>[x.mode,by.get(x.character)]).filter(([,c])=>c);
 if(q.length)startStudyRound('practice',r.config,[...new Map(q.map(([,c])=>[c.c,c])).values()],q);
}

// Keep the first attempt across Pause/reload, including hints and stroke tolerance.
function studyAttemptInfo(){if(!SESS?.study)return null;const [mode,c]=SESS.q[SESS.currentIndex];return SESS.round.attempts?.[mode+':'+c.c]||null;}
function studyAttempt(kind){
 if(!SESS?.study)return;const before=JSON.parse(JSON.stringify(SESS.round)),[mode,c]=SESS.q[SESS.currentIndex],all=SESS.round.attempts||={},r=all[mode+':'+c.c]||={};
 if(kind==='stroke')r.strokes=(r.strokes||0)+1;else r[kind]=true;try{saveStudyRound();}catch(error){SESS.round=before;throw error;}
}
function studyOutcome(outcome){const a=studyAttemptInfo();if(!a||outcome==='skip')return outcome;if(a.miss||a.pinyinMiss)return 'miss';if(a.help||a.strokes>2)return 'assisted';return outcome;}
function resumeLegacyRound(kind){
 const r=S.cfg[kind];if(!r)return false;const excluded=new Set(S.cfg.notLearned||[]);if(!excluded.size)return true;
 const prefix=r.q.slice(0,r.i),after=r.q.slice(r.i).filter(([,c])=>!excluded.has(c));r.q=prefix.concat(after);save();return r.i<r.q.length;
}
function studyQuiz(chars){showStudySetup('review',[...new Set(chars)].map(c=>ALL.find(x=>x.c===c)).filter(Boolean));}
