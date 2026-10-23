// Review-only adapter for the portable completed-history projection.
function recentMistakeContext(){
 const allowed=studyActivities().map(([mode])=>mode);
 const draft=typeof STUDY_DRAFT!=='undefined'&&STUDY_DRAFT?.kind==='review'?STUDY_DRAFT:null;
 const config=JSON.parse(JSON.stringify(draft?draft.config:studyDefaults(S,GR(),'review',CARDS.map(c=>c.c),allowed)));
 return {config,excluded:[...(draft?draft.excluded:S.cfg.notLearned||[])],allowed};
}
function recentMistakeQuery(context,character='',activity=''){
 return MandarinMistakes.queryRecentMistakes(S,{catalog:ALL,characters:character?[character]:context.config.chars,activities:activity?[activity]:context.config.modes.filter(m=>context.allowed.includes(m)),excluded:context.excluded,limit:context.config.limit});
}
function recentMistakeCount(){return recentMistakeQuery(recentMistakeContext()).needs.length;}
function showRecentMistakes(){
 if(document.getElementById('recent-mistakes')?.open)return;
 if(!document.getElementById('study-setup')?.open)showStudySetup('review');
 const context=recentMistakeContext(),state=S,profile=PR.cur,previous=document.activeElement;
 const dialog=document.createElement('dialog');dialog.id='recent-mistakes';dialog.setAttribute('aria-labelledby','recent-mistakes-title');dialog.setAttribute('aria-describedby','recent-mistakes-note');
 dialog.innerHTML=`<div class="recent-mistakes-heading"><h2 id="recent-mistakes-title">Things to practice</h2><button class="study-close" aria-label="Close things to practice">✕</button></div>
 <p id="recent-mistakes-note">Recent saved rounds only · last 20 completed rounds. First scores stay saved.</p>
 <div class="recent-mistakes-filters"><label>Character<select id="recent-mistakes-character" aria-label="Character"><option value="">All selected characters</option></select></label><label>Activity<select id="recent-mistakes-activity" aria-label="Activity"><option value="">All selected activities</option></select></label><label>Questions<select id="recent-mistakes-limit" aria-label="Questions">${[5,10,20,30].map(n=>`<option value="${n}" ${context.config.limit===n?'selected':''}>${n}</option>`).join('')}</select></label></div>
 <div id="recent-mistakes-results" role="region" aria-label="Recent practice needs"></div>
 <div class="recent-mistakes-actions"><button class="btn" id="recent-mistakes-start"></button><div id="recent-mistakes-replace" hidden><p>A Review round is paused. You can resume it or replace it with this review.</p><button class="btn gray" id="recent-mistakes-resume">Resume paused Review</button><button class="btn" id="recent-mistakes-confirm">Replace with this review</button><button class="progress-link" id="recent-mistakes-keep">Keep paused round</button></div></div>`;
 const byId=id=>dialog.querySelector('#recent-mistakes-'+id),character=byId('character'),activity=byId('activity');
 for(const c of [...new Set(context.config.chars)].filter(c=>ALL.some(card=>card.c===c)&&!context.excluded.includes(c))){const option=document.createElement('option');option.value=c;option.textContent=c;character.append(option);}
 for(const [mode,label]of studyActivities())if(context.config.modes.includes(mode)){const option=document.createElement('option');option.value=mode;option.textContent=label;activity.append(option);}
 let expanded=false,current;
 let cleaned=false;
 const cleanup=()=>{if(cleaned)return;cleaned=true;dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});};
 const close=()=>{dialog.close();cleanup();};
 const valid=()=>{if(S===state&&PR.cur===profile)return true;close();return false;};
 const labelFor=mode=>studyActivities().find(([m])=>m===mode)?.[1]||mode;
 const skillLabels={pinyin:'Pinyin',writing:'Writing',listen:'Listening',trace:'Tracing',memory:'Memory writing',flip:'Flip card',words:'Build words'};
 const row=(item,resolved=false)=>{
  const li=document.createElement('li');li.className='recent-mistake-row';
  const head=document.createElement('div'),char=document.createElement('b'),label=document.createElement('span');char.lang='zh-Hans';char.textContent=item.character;label.textContent=labelFor(item.mode);head.append(char,label);li.append(head);
  const chips=document.createElement('div');chips.className='recent-mistake-evidence';
  for(const need of item.needs){const chip=document.createElement('span');
   const skill=need.legacyCombined?'Earlier combined result':skillLabels[need.skill]||need.skill;
   const method=need.method==='self-rated'?'Self-rated':need.method==='checked'?'Checked':'Assessment not recorded';
   chip.textContent=skill+' · '+method+' · '+(resolved?'Practiced again':need.outcome==='assisted'?'Practiced with support':'Try again');chips.append(chip);
  }
  li.append(chips);return li;
 };
 const render=()=>{
  if(!valid())return;current=recentMistakeQuery(context,character.value,activity.value);
  const results=byId('results');results.replaceChildren();
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent=current.needs.length?`${current.needs.length} question${current.needs.length===1?'':'s'} to practice`:current.hasDetails?'No things to practice in this selection.':'No recent saved details yet.';results.append(status);
  if(current.needs.length){const ul=document.createElement('ul');ul.className='recent-mistakes-list';for(const item of current.needs.slice(0,expanded?undefined:6))ul.append(row(item));results.append(ul);
   if(current.needs.length>6){const more=document.createElement('button');more.className='progress-link';more.textContent=expanded?'Show fewer':`Show all ${current.needs.length}`;more.setAttribute('aria-expanded',String(expanded));more.onclick=()=>{expanded=!expanded;render();};results.append(more);}
  }
  if(current.resolved.length){const details=document.createElement('details'),summary=document.createElement('summary'),ul=document.createElement('ul');summary.textContent='Practiced again · '+current.resolved.length;ul.className='recent-mistakes-list';for(const item of current.resolved)ul.append(row(item,true));details.append(summary,ul);results.append(details);}
  byId('start').disabled=!current.pairs.length;byId('start').textContent='Start review'+(current.pairs.length?' · up to '+current.pairs.length:'');byId('start').hidden=false;byId('replace').hidden=true;
 };
 const launch=()=>{
  if(!valid())return;const latest=recentMistakeQuery(context,character.value,activity.value),by=new Map(ALL.map(c=>[c.c,c]));
  const queue=latest.pairs.map(([mode,c])=>[mode,by.get(c)]).filter(([,c])=>c);
  if(!queue.length){render();return;}
  const config={...context.config,chars:[...new Set(queue.map(([,c])=>c.c))],modes:[...new Set(queue.map(([mode])=>mode))]};
  S.cfg.notLearned=context.excluded.slice();close();closeStudySetup();startStudyRound('review',config,config.chars.map(c=>by.get(c)),queue);
 };
 byId('start').onclick=()=>{if(!valid())return;if(currentStudyRound('review')){byId('replace').hidden=false;byId('start').hidden=true;byId('resume').focus();}else launch();};
 byId('confirm').onclick=launch;
 byId('resume').onclick=()=>{if(!valid())return;close();closeStudySetup();resumeStudy('review');};
 byId('keep').onclick=()=>{byId('replace').hidden=true;byId('start').hidden=false;byId('start').focus();};
 character.onchange=activity.onchange=()=>{expanded=false;render();};byId('limit').onchange=()=>{context.config.limit=Number(byId('limit').value);render();};
 dialog.querySelector('.study-close').onclick=close;
 dialog.onclose=cleanup;
 document.body.append(dialog);render();dialog.showModal();dialog.querySelector('.study-close').focus();
}
