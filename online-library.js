// Supported reading and separate comprehension evidence; public text stays outside learner backups.
let ONLINE_READING_CLIENT=null,ONLINE_READING_LAST=null;
function showOnlineLibrary({resume=null,kind='practice',selection=null}={}){
 screen();SESS=null;CRAM=null;delete document.body.dataset.study;feedbackQuestion=null;
 const owner=PR.cur,grade=GR(),library=ONLINE_READING_CLIENT||(ONLINE_READING_CLIENT=GroveOnlineContent.createLibrary(GROVE_ONLINE_LIBRARY));
 const selected=selection||studyDefaults(S,grade,kind,CARDS.map(c=>c.c),studyActivities().map(x=>x[0]));
 const scope=GroveReadings.readingScope({grade,chars:selected.chars,excluded:S.cfg.notLearned||[],grades:GL});
 const allItems=[...GROVE_READING_PRACTICE.items,...library.list()];
 const items=allItems.filter(item=>GroveReadings.readingMatch(item,scope).eligible&&(kind!=='review'||item.questions?.length)).sort((a,b)=>GroveReadings.readingMatch(b,scope).rank-GroveReadings.readingMatch(a,scope).rank);
 const rawScopeLabel=studyScopeText(selected),scopeLabel=rawScopeLabel.startsWith(GN[grade]+' ·')?rawScopeLabel:GN[grade]+' · '+rawScopeLabel;
 const returnToChoices=()=>{home();showStudySetup(kind);};
 A.innerHTML=`<section class="online-library" id="online-library" aria-labelledby="online-title"><div class="writing-heading"><span class="writing-tree" aria-hidden="true">${writingBook()}</span><div><h1 id="online-title">Read Chinese</h1><p>Choose a reading for your practice choices.</p></div></div><div class="online-scope-controls"><p class="reading-note online-grade">${esc(scopeLabel)}</p><button class="btn gray" id="reading-choices">Change choices</button></div><p id="online-offline" class="reading-note" role="status" hidden></p><div id="online-panel"></div><details class="compact-help"><summary>About these samples</summary><p>Readings practise your selected characters. Earlier-grade characters may support the story. Through Grade 3, other characters must be in your selection; from Grade 4, new characters may appear. This checks character fit, not whether every word or idea has been taught.</p><p>Text pinyin and translations are reading aids; teaching review is pending. Pinyin uses lexical tones, not an acoustic transcription. Comprehension questions record their own answers and help use; they do not award stars or change character mastery. No new recordings are included.</p><p>Opening an unsaved sample requests its public source text. The provider receives normal connection details, including your IP address. Names, drafts and progress are not sent. Optional saved readings are shared public text on this browser, separate from progress backups. Your browser may clear them. The starter readings and dictionary are installed with the offline app; other readings can be saved separately.</p><a href="content/online-reading-notices.txt" target="_blank" rel="noopener noreferrer">Source credits &amp; licenses</a></details></section>`;
 $('reading-choices').onclick=()=>{if(active()){stop();returnToChoices();}};
 const root=$('online-library'),panel=$('online-panel'),offline=$('online-offline');let current=null,revision=0,flushReading=null;
 root.addEventListener('keydown',feedbackButtonKeydown);
 const active=()=>root.isConnected&&$('online-library')===root&&PR.cur===owner&&GR()===grade;
 const stop=()=>{if(flushReading){flushReading();flushReading=null;}revision++;current?.abort();current=null;};
 const connection=()=>{if(!active())return;offline.hidden=navigator.onLine!==false;offline.textContent=offline.hidden?'':'You’re offline. Starter readings and saved readings are available.';};
 addEventListener('online',connection);addEventListener('offline',connection);connection();
 const observer=new MutationObserver(()=>{if(!active()){stop();observer.disconnect();removeEventListener('online',connection);removeEventListener('offline',connection);}});observer.observe(A,{childList:true});
 function node(tag,value,parent,cls){const el=document.createElement(tag);if(value)el.textContent=value;if(cls)el.className=cls;if(parent)parent.append(el);return el;}
 function button(label,parent,action,cls='btn gray'){const b=node('button',label,parent,cls);b.type='button';b.onclick=()=>{if(active()&&b.isConnected)action();};return b;}
 function link(label,url,parent){const a=node('a',label,parent);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
 function list(focusId){
  stop();setPageBack(()=>{stop();returnToChoices();},'Back to '+(kind==='review'?'Review':'Practice'));feedbackQuestion=null;panel.replaceChildren();
  for(const [kind,label]of [['story','Short readings'],['sentence','Sentences']]){
   const group=items.filter(i=>i.kind===kind);if(!group.length)continue;
   const section=node('section',null,panel);node('h2',label,section);const grid=node('div',null,section,'online-grid');
   for(const item of group){
    const card=node('article',null,grid,'online-card'),heading=node('h3',item.titleZh,card);heading.lang='zh-Hans';
    const b=button('Read',card,()=>read(item));b.dataset.reading=item.id;b.setAttribute('aria-label','Read · '+item.titleZh);
    const match=GroveReadings.readingMatch(item,scope);if(match.unknown.length)node('p',match.unknown.length+' new character'+(match.unknown.length===1?'':'s')+' · tap for help',card,'reading-note');
    const saved=node('span',item.local?'Included offline':'Saved',card,'online-saved');saved.dataset.saved=item.id;saved.hidden=true;
    if(!item.local)library.isSaved(item.id).then(ready=>{if(active()&&card.isConnected)saved.hidden=!ready;}).catch(()=>{});
    if(item.id===focusId)b.focus();
   }
  }
  if(!items.length)node('p','No readings fit these choices yet. Try other units or characters.',panel,'reading-note');
 }
 async function read(item,usePrevious=false){
  if(!items.some(i=>i.id===item.id))return;
  stop();const token=revision;current=new AbortController();const signal=current.signal;
  panel.replaceChildren();const detail=node('section',null,panel);detail.id='online-detail';
  const heading=node('h2',item.kind==='story'?item.titleZh:'Sentence',detail,item.kind==='sentence'?'sr-only':null);heading.tabIndex=-1;if(item.kind==='story')heading.lang='zh-Hans';heading.focus();
  setPageBack(()=>list(item.id),'Back to readings');
  const status=node('p','Loading…',detail,'reading-note');status.setAttribute('role','status');
  const context={content:{packId:item.local?GROVE_READING_PRACTICE.id:'grove-online-reading',itemId:item.id,version:item.local?GROVE_READING_PRACTICE.version:library.version,sourceId:item.sourceId,reviewStatus:item.reviewStatus}};feedbackQuestion=context;
  const report=()=>showFeedback({category:'meaning',note:'Reading: '+item.titleZh+'\nItem: '+item.id,context});
  try{
   const previous=usePrevious&&ONLINE_READING_LAST?.owner===owner&&ONLINE_READING_LAST?.grade===grade&&ONLINE_READING_LAST?.id===item.id&&ONLINE_READING_LAST?.kind===kind?ONLINE_READING_LAST:null;
   const result=previous?.result||(item.local?{paragraphs:item.paragraphs.slice(),translation:item.support.english.slice(),saved:true}:await library.read(item.id,{signal}));
   if(!active()||token!==revision)return;current=null;
   if(!GroveReadings.readingMatch({...item,characters:[...new Set((item.titleZh+result.paragraphs.join('')).match(/\p{Script=Han}/gu)||[])]},scope).eligible)throw Error('reading-grade-unavailable');
   const aids=item.local?{pinyin:item.support.pinyin,translation:item.support.english}:GroveOnlineContent.readingAids(item,result);status.remove();
   const sentences=GroveReadings.readingSentences(result.paragraphs,aids,item.annotations),questions=item.questions||[];
   const version=item.local?GROVE_READING_PRACTICE.version:library.version,key=item.id+'|'+version+'|'+kind;
   const raw=S.readingStudy?.sessions?.[key],restored=item.local?GroveReadings.restoreReadingSession(raw,{id:item.id,version,kind,count:sentences.length},questions):null;
   const view=previous||{...(restored||GroveReadings.newReadingSession(item.id,version,kind,sentences.length,Date.now())),owner,grade,result};ONLINE_READING_LAST=view;
   const saveNote=node('p',null,detail,'reading-note');saveNote.id='reading-save-status';saveNote.setAttribute('role','status');saveNote.hidden=true;
   const retrySave=button('Try saving again',detail,()=>{if(persist())renderQuestions();});retrySave.id='reading-save-retry';retrySave.hidden=true;
   let preservePrevious=!!raw&&!restored;
   function snapshot(){return Object.fromEntries(['id','version','kind','attempt','created','phase','cursor','responses','pinyin','english','helpUsed','position'].map(k=>[k,view[k]]));}
   function persist(throwFailure=false){
    if(!item.local||!active()||token!==revision)return true;
    const old=S.readingStudy;S.readingStudy=GroveReadings.storeReadingSession(old,key,snapshot(),preservePrevious);
    try{save();preservePrevious=false;view.unsaved=false;saveNote.hidden=true;retrySave.hidden=true;return true;}
    catch(error){if(old===undefined)delete S.readingStudy;else S.readingStudy=old;view.unsaved=true;saveNote.hidden=false;saveNote.textContent='Could not save reading progress. Try saving again before continuing.';retrySave.hidden=false;if(throwFailure)throw error;return false;}
    finally{detail.querySelectorAll('[data-reading-action]').forEach(b=>b.disabled=!!view.unsaved||b.dataset.ready!=='yes');}
   }
   const passages=node('div',null,detail,'online-passages');passages.id='online-passages';
   const instruction=node('p',questions.length?'Read the story, then answer '+questions.length+' questions. Tap words or reveal help when you need it.':'Tap a word for its meaning. Show help for one sentence at a time.',detail,'reading-note');detail.insertBefore(instruction,passages);
   const lines=[];let dictionary=null;
   const helped=()=>{view.helpUsed=true;persist();const help=detail.querySelector('#reading-help-status');if(help)help.textContent='Help is on for this reading.';};
   function lookup(word,prepared,trigger){
    helped();const dialog=node('dialog',null,detail,'reading-lookup');dialog.setAttribute('aria-labelledby','reading-lookup-title');
    const title=node('h2',word,dialog);title.id='reading-lookup-title';title.lang='zh-Hans';
    const close=button('Close',dialog,()=>dialog.close());close.id='reading-lookup-close';
    dialog.addEventListener('close',()=>{dialog.remove();if(trigger?.isConnected)trigger.focus({preventScroll:true});});
    const body=node('div',null,dialog);body.id='reading-lookup-body';
    if(prepared?.meaning){node('h3','In this sentence',body);const py=node('p',prepared.pinyin,body);py.lang='zh-Latn-pinyin';node('p',prepared.meaning,body);}
    const status=node('p','Loading dictionary…',body,'reading-note');status.setAttribute('role','status');
    async function load(){
     try{const index=dictionary||await loadHelpDictionary();if(!active()||!dialog.isConnected||token!==revision)return;dictionary=index;status.remove();
      node('h3','Dictionary meanings',body);const rows=[...new Set(index.get(word)||[])];
      if(!rows.length){node('p','This dictionary has no entry for '+word+'.',body);button('Suggest a missing entry',body,()=>{dialog.close();showFeedback({category:'meaning',note:'Reading lookup missing entry: '+word,context});});}
      for(const entry of rows.slice(0,12)){const row=node('section',null,body,'reading-dictionary-entry'),py=node('p',pinyinWithMarks(entry[2]),row);py.lang='zh-Latn-pinyin';node('p',entry[3],row);}
      if(rows.length>1)node('p','A word may have several readings or meanings. Choose the one that fits the sentence.',body,'reading-note');
      if([...word].length>1){node('h3','Individual characters',body);const chars=node('div',null,body,'online-words');for(const ch of [...new Set(word)]){const b=button(ch,chars,()=>{dialog.close();lookup(ch,null,trigger);},'btn gray');b.lang='zh-Hans';}}
     }catch{if(dialog.isConnected&&active()){status.textContent='The dictionary could not load.';button('Try again',body,load);}}
    }
    dialog.showModal();close.focus();load();
   }
   for(const [i,sentence]of sentences.entries()){
    const paragraph=node('section',null,passages,'online-paragraph');paragraph.setAttribute('aria-label','Sentence '+(i+1));
    const textGroup=node('div',null,paragraph,'online-sentence-text');
    const line=node('p',null,textGroup,'online-line');lines.push(line);
    const py=node('p',sentence.pinyin,textGroup,'online-pinyin');py.id='reading-pinyin-'+i;py.lang='zh-Latn-pinyin';py.hidden=!view.pinyin[i];
    const en=node('p',sentence.english,textGroup,'online-english');en.id='reading-english-'+i;en.lang='en';en.hidden=!view.english[i];
    const controls=node('div',null,paragraph,'online-aid-controls');
    for(const [type,row,label]of [['pinyin',py,'pinyin'],['english',en,'English']]){
     const b=button('',controls,()=>{view[type][i]=!view[type][i];if(view[type][i])helped();else persist();refresh();});b.id='online-show-'+type+(i?'-'+i:'');b.setAttribute('aria-controls',row.id);
     const refresh=()=>{b.textContent=(view[type][i]?'Hide ':'Show ')+label;b.setAttribute('aria-label',b.textContent+' for sentence '+(i+1));b.setAttribute('aria-expanded',String(!!view[type][i]));row.hidden=!view[type][i];};refresh();
    }
    function render(){line.replaceChildren();for(const part of GroveReadings.readingTokens(sentence.text,dictionary,sentence.words)){
     if(!part.lookup){line.append(document.createTextNode(part.text));continue;}
     const b=button('',line,()=>lookup(part.text,part,b),'reading-word');b.setAttribute('aria-label','Look up '+part.text);const span=node('span',part.text,b);span.lang='zh-Hans';
    }}render();sentence.render=render;
   }
   loadHelpDictionary().then(index=>{if(!active()||token!==revision)return;dictionary=index;if(!detail.querySelector('dialog[open]')&&!passages.contains(document.activeElement))for(const sentence of sentences)sentence.render();}).catch(()=>{});
   const questionArea=node('section',null,detail,'reading-questions');questionArea.id='reading-questions';questionArea.setAttribute('aria-label','Reading questions');
   function renderQuestions(focus=false){
    questionArea.replaceChildren();if(!questions.length)return;
    const title=node('h2',view.phase==='done'?'Reading finished':'Read and answer',questionArea);title.tabIndex=-1;
    if(view.phase==='reading'){
     const start=button('Answer '+questions.length+' questions',questionArea,()=>{view.phase='questions';if(persist())renderQuestions(true);});start.id='reading-start-questions';start.dataset.readingAction='start';start.dataset.ready='yes';start.disabled=!!view.unsaved;
    }else if(view.phase==='done'){
     const results=Object.values(view.responses),right=results.filter(r=>r.correct).length,help=results.filter(r=>r.assisted).length;
     node('p',right+' of '+questions.length+' correct · '+help+' answered with help',questionArea);node('p','You finished this reading. Try another story or read it again.',questionArea,'reading-note');
     const again=button('Read again',questionArea,()=>{Object.assign(view,GroveReadings.newReadingSession(item.id,version,kind,sentences.length,Date.now()));if(persist())read(item);});again.id='reading-again';again.dataset.readingAction='again';again.dataset.ready='yes';again.disabled=!!view.unsaved;
     button('Choose another reading',questionArea,()=>list(item.id)).id='reading-finish';
    }else{
     const q=questions[view.cursor],response=view.responses[q.id];if(!q)return;
     node('p','Question '+(view.cursor+1)+' of '+questions.length,questionArea,'reading-note');
     const help=node('p',view.helpUsed?'Help is on for this reading.':'You can look back at the story or use help.',questionArea,'reading-note');help.id='reading-help-status';
     const form=node('form',null,questionArea),fieldset=node('fieldset',null,form);node('legend',q.prompt,fieldset);fieldset.disabled=!!response;
     let choice=response?.choice||'';
     for(const option of q.options){const label=node('label',null,fieldset,'reading-answer'),input=node('input',null,label);input.type='radio';input.name='reading-answer';input.value=option.id;input.checked=choice===option.id;node('span',option.text,label);input.onchange=()=>{choice=option.id;check.dataset.ready='yes';check.disabled=!!view.unsaved;};}
     const check=node('button','Check answer',form,'btn');check.id='reading-check';check.type='submit';check.dataset.readingAction='check';check.dataset.ready=choice&&!response?'yes':'no';check.disabled=!choice||!!response||!!view.unsaved;
     form.onsubmit=event=>{event.preventDefault();if(!active()||token!==revision||view.unsaved||view.responses[q.id]||!choice)return;Object.assign(view,GroveReadings.recordReadingAnswer(snapshot(),q,choice));if(persist())renderQuestions(true);};
     if(response){
      const result=node('p',(response.correct?'Correct. ':'Have another look. ')+q.explanation,questionArea);result.id='reading-answer-feedback';result.setAttribute('role','status');
      node('p',response.assisted?'Answered with help.':'Answered without pinyin, English or dictionary help.',questionArea,'reading-note');
      const next=button(view.cursor+1===questions.length?'Finish reading':'Next question',questionArea,()=>{view.cursor++;if(view.cursor===questions.length)view.phase='done';if(persist())renderQuestions(true);});next.id='reading-next';next.dataset.readingAction='next';next.dataset.ready='yes';next.disabled=!!view.unsaved;
     }
     button('Look back at the story',questionArea,()=>passages.scrollIntoView({block:'start'}));
    }
    if(focus)title.focus();
   }
   renderQuestions();
   if(item.local){
    persist();
    flushReading=()=>{if(!active()||token!==revision)return;const visible=lines.findIndex(el=>el.getBoundingClientRect().bottom>100);if(visible>=0)view.position=visible;persist(true);};
    if(restored||previous)requestAnimationFrame(()=>{if(!active()||token!==revision)return;if(view.phase==='questions'||view.phase==='done')questionArea.scrollIntoView({block:'start'});else lines[view.position]?.scrollIntoView({block:'center'});});
   }
   const words=node('details',null,detail,'compact-help');words.id='online-word-tools';node('summary','Look up a word',words);const wordButtons=node('div',null,words,'online-words');
   for(const word of item.words){
    const b=button('Look up '+word,wordButtons,()=>{helped();stop();HELP_LOOKUP_SESSION={owner:PR.cur,query:word,selected:new Set(),limit:24};showHomeworkLookup({back:()=>showOnlineLibrary({resume:item.id,kind,selection:selected}),backLabel:'Back to reading'});},'chip');
    // The interface remains English; only the word itself is Chinese.
    b.replaceChildren(document.createTextNode('Look up '));const glyph=node('span',word,b);glyph.lang='zh-Hans';
   }
   if(!item.local){
   const savedTools=node('details',null,detail,'compact-help');savedTools.id='online-save-tools';node('summary','Save for offline',savedTools);
   const saveStatus=node('p',result.saved?'Saved copy on this browser.':'',savedTools,'reading-note');saveStatus.id='online-save-status';saveStatus.setAttribute('role','status');
   const actions=node('div',null,savedTools,'online-actions');
   const save=button('Save for offline',actions,async()=>{
    save.disabled=true;remove.disabled=true;
    try{await library.save(item.id,result);if(!active()||token!==revision)return;result.saved=true;saveStatus.textContent='Saved for offline on this browser.';save.hidden=true;remove.hidden=false;remove.disabled=false;remove.focus();}
    catch{if(active()&&token===revision)saveStatus.textContent='Could not save this reading. You can still read it here; try saving again.';}
    finally{if(active()&&token===revision){save.disabled=false;remove.disabled=false;}}
   });save.id='online-save';save.hidden=result.saved;
   const remove=button('Remove saved copy',actions,async()=>{
    save.disabled=true;remove.disabled=true;
    try{await library.remove(item.id);if(!active()||token!==revision)return;result.saved=false;saveStatus.textContent='Removed the saved copy.';remove.hidden=true;save.hidden=false;save.disabled=false;save.focus();}
    catch{if(active()&&token===revision)saveStatus.textContent='Could not remove the saved copy. Try again.';}
    finally{if(active()&&token===revision){save.disabled=false;remove.disabled=false;}}
   });remove.id='online-remove';remove.hidden=!result.saved;
   }
   const credits=node('details',null,detail,'compact-help online-source');credits.id='online-source';node('summary','Source & credits',credits);
   if(item.local){node('p','Original text, pinyin and English prepared by Mandarin Grove. Teaching review is pending.',credits);}
   else if(item.kind==='story'){
    node('p',item.authors[0]+' · Chinese translation: '+item.authors[1]+'.',credits);node('p','Original illustrations: '+item.illustrators+'. Illustrations omitted. Chinese text unchanged; English adapted and pinyin added by Mandarin Grove.',credits);link('Global Storybooks · original reading',item.sourceUrl,credits);link('English source reference',item.support.englishReference.url,credits);
   }else{
    node('p','Tatoeba contributors · Chinese: '+item.authors[0]+' · English: '+item.authors[1]+'. Text unchanged; pinyin added by Mandarin Grove.',credits);link('Original Chinese sentence',item.sourceUrl,credits);link('Original English sentence','https://tatoeba.org/en/sentences/show/'+item.translationId,credits);
   }
   if(!item.local)link(item.license,library.licenseUrl(item.id),credits);node('p','Text aids prepared for these samples; teaching review pending.',credits,'reading-note');
   button('Report a problem with this reading',detail,report,'progress-link').id='online-report';
  }catch(error){
   if(!active()||token!==revision)return;current=null;status.remove();
   const message=node('p',error.message==='reading-changed'?'This source has changed. Please try another reading.':error.message==='reading-grade-unavailable'?'This reading no longer fits your choices. Please choose another reading.':'We could not load this reading. Try again, or open a saved reading.',detail,'reading-note');message.id='online-error';message.setAttribute('role','status');
   button('Try again',detail,()=>read(item)).id='online-retry';button('Report this loading problem',detail,report,'progress-link').id='online-report';
  }
 }
 const onHide=()=>{try{flushReading?.();}catch{}};addEventListener('pagehide',onHide);const cleanup=new MutationObserver(()=>{if(!active()){removeEventListener('pagehide',onHide);cleanup.disconnect();}});cleanup.observe(A,{childList:true});
 list();if(resume){const item=items.find(i=>i.id===resume);if(item)read(item,true);}
}
