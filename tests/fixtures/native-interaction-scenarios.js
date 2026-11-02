// Read-only installed UI/layout scenarios, loaded by explicit synthetic-device runners only.
(function(root){
 const check=(ok,message)=>{if(!ok)throw Error(message);},copy=v=>JSON.parse(JSON.stringify(v));
 const wait=async(fn,message)=>{const end=Date.now()+15000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,25));}throw Error(message);};
 let prior,registry,priorAppearance,priorReports,baseline,lastMetrics;
 const cases={
  home:async()=>{await home();check(document.body.dataset.screen==='home','Home did not render');},
  practice:async()=>{showStudySetup('practice');check(document.getElementById('study-title').textContent==='Practice','Practice choices missing');},
  review:async()=>{showStudySetup('review');check(document.getElementById('study-title').textContent==='Review','Review choices missing');},
  activeListen:async()=>{listen(ALL.find(c=>c.c==='学'));await wait(()=>document.querySelectorAll('.choices button').length===4,'Active listening answers missing');},
  activeFlip:async()=>{flip(ALL.find(c=>c.c==='学'));document.getElementById('cd').click();check(document.getElementById('flip-rating')?.hidden===false,'Revealed reading card missing');},
  activeTrace:async()=>{trace();await wait(()=>document.querySelector('#hw svg, #hw canvas'),'Packaged tracing guide missing');},
  activeMemory:async()=>{memory(ALL.find(c=>c.c==='学'));await wait(()=>document.querySelector('#hw svg, #hw canvas'),'Packaged memory-writing guide missing');},
  help:async()=>{showHomeworkHelp();check(document.querySelector('#app h1').textContent==='Help','Help missing');},
  dictionary:async()=>{showHomeworkLookup();document.getElementById('lookup-input').value='学校';document.getElementById('lookup-search').click();await wait(()=>document.querySelector('[data-lookup-text="学校"]'),'Offline packaged dictionary did not load 学校');document.querySelector('[data-lookup-text="学校"]').click();await wait(()=>document.getElementById('lookup-detail')&&!document.getElementById('lookup-detail').hidden,'Dictionary detail missing');},
  writing:async()=>{showWritingIdeas();check(!!document.getElementById('writing-input'),'Writing input missing');},
  summary:async()=>{showSummaryHelp();check(!!document.getElementById('summary-draft'),'Summary draft missing');},
  words:async()=>{showWordPractice([ALL.find(c=>c.c==='学')]);await wait(()=>document.getElementById('word-check')&&!document.getElementById('word-check').disabled,'Offline word builder did not become ready');},
  progress:async()=>{await kidProgress();await wait(()=>document.querySelector('#app h1')?.textContent==='My progress','Progress missing');},
  grove:async()=>{showGroveRewards();await wait(()=>document.querySelector('#app h1')?.textContent==='Your grove','Grove heading missing');},
  badges:async()=>{rewardCollection();await wait(()=>document.querySelector('#app h1')?.textContent==='My badges','Collection heading missing');},
  mistakes:async()=>{showRecentMistakes();await wait(()=>document.getElementById('recent-mistakes-title'),'Recent mistakes missing');},
  characters:async()=>{cat();await wait(()=>document.querySelector('#app h1')?.textContent==='All characters','Character browser missing');},
  history:async()=>{pastQ();await wait(()=>document.querySelector('#app h1')?.textContent==='Past quizzes','History missing');},
  cram:async()=>{await showCram();await wait(()=>document.getElementById('cram-count'),'Unit review choices missing');},
  readings:async()=>{showOnlineLibrary({selection:{units:[],chars:ALL.map(c=>c.c),modes:['trace'],limit:10}});await wait(()=>document.querySelector('[data-reading="grove-pets"]'),'Bundled reading catalog missing');check(document.getElementById('online-library')?.isConnected,'Reading catalog missing');},
  settings:async()=>{await grown('device');check(document.getElementById('gov')?.open,'Native settings missing');},
  feedback:async()=>{await showFeedback({category:'broken',note:'Synthetic read-only layout check'});check(document.getElementById('feedback-dialog')?.open,'Feedback missing');}
 };
 async function closeDialogs(){for(const d of [...document.querySelectorAll('dialog[open]')].reverse()){if(d.id==='study-setup')closeStudySetup();else profileClose(d);}await new Promise(r=>setTimeout(r,0));}
 async function begin(){
  await GROVE_STARTED;check(GrovePlatform.persistenceReady&&!window.GroveNativeTest,'Ordinary installed artifact required');const r=await GROVE_REPOSITORY.peekRegistry();check(r.list.length&&r.list.every(p=>p.id.startsWith('synthetic-')),'Dedicated synthetic learners only');
  prior=await backup();registry=copy(PR);priorAppearance=appearance;priorReports=await feedbackReports();
  PR={...copy(r),cur:r.cur||r.list[0].id};await loadS({persist:false});await closeDialogs();await home();baseline=await backup();
  check(baseline===prior,'Opening the existing synthetic learner unexpectedly changed saved progress');check(Object.keys(localStorage).length===0,'Native learner data must not use localStorage');return {prior,priorReports,selected:PR.cur};
 }
 function metrics(name,theme){
  const shown=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
  const small=[...document.querySelectorAll('button,input[type=button],input[type=submit]')].filter(shown).map(el=>{const r=el.getBoundingClientRect();return {label:el.getAttribute('aria-label')||el.textContent.trim().slice(0,70),width:r.width,height:r.height};}).filter(r=>r.width<24||r.height<24);
  const visibleWidth=Math.min(innerWidth,visualViewport?.width||innerWidth,document.documentElement.clientWidth);const overflow=[...document.querySelectorAll('body *')].filter(el=>el instanceof HTMLElement&&shown(el)).map(el=>{const r=el.getBoundingClientRect(),style=getComputedStyle(el);return {tag:el.tagName,id:el.id,className:el.className,left:r.left,right:r.right,width:r.width,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,font:style.fontSize,minWidth:style.minWidth,grid:style.gridTemplateColumns,whiteSpace:style.whiteSpace};}).filter(r=>r.right>visibleWidth+2||r.left< -2).slice(0,35);
  const dialogs=[...document.querySelectorAll('dialog[open]')].map(d=>({id:d.id,labelled:!!document.getElementById(d.getAttribute('aria-labelledby')),focusInside:d.contains(document.activeElement),width:d.getBoundingClientRect().width,scrollWidth:d.scrollWidth,clientWidth:d.clientWidth}));
  const probe=document.createElement('span');probe.textContent='Mandarin Grove 字';probe.setAttribute('aria-hidden','true');probe.style.cssText='position:fixed;left:-10000px;top:0;font:calc(16px * var(--grove-text-scale,1)) system-ui;white-space:nowrap;';document.body.append(probe);const range=document.createRange();range.selectNodeContents(probe);const glyph=range.getBoundingClientRect(),textProbe={cssFont:getComputedStyle(probe).fontSize,glyphWidth:glyph.width,glyphHeight:glyph.height};probe.remove();
  const rootStyle=document.documentElement.style,textAdjustment={inlineWebkit:rootStyle.getPropertyValue('-webkit-text-size-adjust'),inlineStandard:rootStyle.getPropertyValue('text-size-adjust'),computedWebkit:getComputedStyle(document.documentElement).getPropertyValue('-webkit-text-size-adjust')};const realText=[...document.querySelectorAll('#app h1,.study-home-entries b,.grove-hero p')].slice(0,8).map(el=>{const r=document.createRange();r.selectNodeContents(el);const box=r.getBoundingClientRect();return {tag:el.tagName,className:el.className,font:getComputedStyle(el).fontSize,glyphHeight:box.height,glyphWidth:box.width};});
  const scrollOverflow=[...document.querySelectorAll('body *')].filter(el=>el instanceof HTMLElement&&shown(el)&&el.scrollWidth>el.clientWidth+2).map(el=>{const r=el.getBoundingClientRect(),style=getComputedStyle(el);return {tag:el.tagName,id:el.id,className:el.className,left:r.left,right:r.right,width:r.width,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,font:style.fontSize,overflow:style.overflow,whiteSpace:style.whiteSpace};}).slice(0,35);
  return {name,theme,textProbe,textAdjustment,realText,overflow,scrollOverflow,viewport:{width:innerWidth,height:innerHeight,visualWidth:visualViewport?.width,visualHeight:visualViewport?.height,visualScale:visualViewport?.scale,clientWidth:document.documentElement.clientWidth},documentWidth:document.documentElement.scrollWidth,bodyFont:getComputedStyle(document.body).fontSize,heading:(document.querySelector('dialog[open] h2')||document.querySelector('#app h1'))?.textContent||null,dialogs,smallTargets:small};
 }
 async function runCase(name,theme){
  check(!!baseline&&Object.hasOwn(cases,name),'Begin a supported case first');await closeDialogs();await stopSpeech();appearance=theme;applyAppearance();await home();await cases[name]();await new Promise(requestAnimationFrame);const result=metrics(name,theme);lastMetrics=result;const visibleWidth=Math.min(innerWidth,visualViewport?.width||innerWidth,document.documentElement.clientWidth);check(result.documentWidth<=visibleWidth+2,name+' exceeds the visible viewport');for(const d of result.dialogs){check(d.labelled,name+' dialog lacks a valid accessible heading');check(d.focusInside,name+' dialog lost keyboard focus');check(d.scrollWidth<=d.clientWidth+2,name+' dialog has horizontal overflow');}check(await backup()===baseline,name+' unexpectedly changed saved learner data');check(JSON.stringify(await feedbackReports())===JSON.stringify(priorReports),name+' changed saved reports');return result;
 }
 async function finish(){
  if(!prior)return;await closeDialogs();await stopSpeech();appearance=priorAppearance;applyAppearance();PR=registry;await loadS({persist:false});if(PR.cur)await home();else who();check(await backup()===prior,'Read-only interaction changed original learner backup');check(JSON.stringify(await feedbackReports())===JSON.stringify(priorReports),'Read-only interaction changed raw reports');check(Object.keys(localStorage).length===0,'Native storage fallback occurred');return {exactProgress:true,exactRawReports:true,noBrowserLearnerStorage:true};
 }
 root.GroveNativeInteraction={begin,runCase,finish,names:Object.keys(cases),get lastMetrics(){return lastMetrics;}};
})(window);
