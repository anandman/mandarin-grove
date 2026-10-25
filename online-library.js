// Read-only samples and optional text aids; downloaded public text is outside learner records.
let ONLINE_READING_CLIENT=null,ONLINE_READING_LAST=null;
function showOnlineLibrary({resume=null}={}){
 screen();SESS=null;CRAM=null;delete document.body.dataset.study;feedbackQuestion=null;
 const owner=PR.cur,grade=GR(),library=ONLINE_READING_CLIENT||(ONLINE_READING_CLIENT=GroveOnlineContent.createLibrary(GROVE_ONLINE_LIBRARY));
 const items=library.list().filter(item=>GroveOnlineContent.eligibleReading(item,grade,GL));
 A.innerHTML=`<section class="online-library" id="online-library" aria-labelledby="online-title"><div class="writing-heading"><span class="writing-tree" aria-hidden="true">${writingBook()}</span><div><h1 id="online-title">Read Chinese</h1><p>Show pinyin or English when you need help.</p></div></div><p class="reading-note online-grade">${esc(GN[grade])}${Number(grade)>=4?' · readings may include new characters':''}</p><p id="online-offline" class="reading-note" role="status" hidden></p><div id="online-panel"></div><details class="compact-help"><summary>About these samples</summary><p>These are sample texts while we work out the homework Help journeys. Readings through Grade 3 use characters in this app’s school lists through that grade. From Grade 4, new characters may appear. This is a character check, not a claim that every word or idea has been taught.</p><p>Text pinyin and translations are reading aids; teaching review is pending. Pinyin uses lexical tones, not an acoustic transcription. No new recordings or scoring are included.</p><p>Opening an unsaved sample requests its public source text. The provider receives normal connection details, including your IP address. Names, drafts and progress are not sent. Optional saved readings are shared public text on this browser, separate from progress backups. Your browser may clear them. Offline use needs the app already loaded.</p><a href="content/online-reading-notices.txt" target="_blank" rel="noopener noreferrer">Source credits &amp; licenses</a></details></section>`;
 const root=$('online-library'),panel=$('online-panel'),offline=$('online-offline');let current=null,revision=0;
 root.addEventListener('keydown',feedbackButtonKeydown);
 const active=()=>root.isConnected&&$('online-library')===root&&PR.cur===owner&&GR()===grade;
 const stop=()=>{revision++;current?.abort();current=null;};
 const connection=()=>{if(!active())return;offline.hidden=navigator.onLine!==false;offline.textContent=offline.hidden?'':'You’re offline. Open a saved reading or reconnect.';};
 addEventListener('online',connection);addEventListener('offline',connection);connection();
 const observer=new MutationObserver(()=>{if(!active()){stop();observer.disconnect();removeEventListener('online',connection);removeEventListener('offline',connection);}});observer.observe(A,{childList:true});
 function node(tag,value,parent,cls){const el=document.createElement(tag);if(value)el.textContent=value;if(cls)el.className=cls;if(parent)parent.append(el);return el;}
 function button(label,parent,action,cls='btn gray'){const b=node('button',label,parent,cls);b.type='button';b.onclick=action;return b;}
 function link(label,url,parent){const a=node('a',label,parent);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
 function list(focusId){
  stop();setPageBack(()=>{stop();showHomeworkHelp();},'Back to Help');feedbackQuestion=null;panel.replaceChildren();
  for(const [kind,label]of [['story','Short readings'],['sentence','Sentences']]){
   const group=items.filter(i=>i.kind===kind);if(!group.length)continue;
   const section=node('section',null,panel);node('h2',label,section);const grid=node('div',null,section,'online-grid');
   for(const item of group){
    const card=node('article',null,grid,'online-card'),heading=node('h3',item.titleZh,card);heading.lang='zh-Hans';
    const b=button('Read',card,()=>read(item));b.dataset.reading=item.id;b.setAttribute('aria-label','Read · '+item.titleZh);
    const saved=node('span','Saved',card,'online-saved');saved.dataset.saved=item.id;saved.hidden=true;
    library.isSaved(item.id).then(ready=>{if(active()&&card.isConnected)saved.hidden=!ready;}).catch(()=>{});
    if(item.id===focusId)b.focus();
   }
  }
  if(!items.length)node('p','No samples match this grade’s character list yet.',panel,'reading-note');
 }
 async function read(item,usePrevious=false){
  if(!items.some(i=>i.id===item.id))return;
  stop();const token=revision;current=new AbortController();const signal=current.signal;
  panel.replaceChildren();const detail=node('section',null,panel);detail.id='online-detail';
  const heading=node('h2',item.kind==='story'?item.titleZh:'Sentence',detail,item.kind==='sentence'?'sr-only':null);heading.tabIndex=-1;if(item.kind==='story')heading.lang='zh-Hans';heading.focus();
  setPageBack(()=>list(item.id),'Back to readings');
  const status=node('p','Loading…',detail,'reading-note');status.setAttribute('role','status');
  const context={content:{packId:'grove-online-reading',itemId:item.id,version:library.version,sourceId:item.sourceId,reviewStatus:item.reviewStatus}};feedbackQuestion=context;
  const report=()=>showFeedback({category:'meaning',note:'Reading: '+item.titleZh+'\nItem: '+item.id,context});
  try{
   const previous=usePrevious&&ONLINE_READING_LAST?.owner===owner&&ONLINE_READING_LAST?.grade===grade&&ONLINE_READING_LAST?.id===item.id?ONLINE_READING_LAST:null;
   const result=previous?.result||await library.read(item.id,{signal});
   if(!active()||token!==revision)return;current=null;
   if(!GroveOnlineContent.eligibleReadingText([item.titleZh,...result.paragraphs],grade,GL))throw Error('reading-grade-unavailable');
   const aids=GroveOnlineContent.readingAids(item,result);status.remove();
   const view={owner,grade,id:item.id,result,pinyin:previous?.pinyin||false,english:previous?.english||false};ONLINE_READING_LAST=view;
   const controls=node('div',null,detail,'online-aid-controls');
   const passages=node('div',null,detail,'online-passages');passages.id='online-passages';passages.lang='zh-Hans';
   const pinyin=[],english=[];
   for(const [i,text]of result.paragraphs.entries()){
    const paragraph=node('div',null,passages,'online-paragraph');node('p',text,paragraph,'online-line');
    const py=node('p',aids.pinyin[i],paragraph,'online-pinyin');py.lang='zh-Latn-pinyin';py.hidden=!view.pinyin;pinyin.push(py);
    const en=node('p',aids.translation[i],paragraph,'online-english');en.lang='en';en.hidden=!view.english;english.push(en);
   }
   const toggle=(type,rows)=>{
    const b=button('',controls,()=>{view[type]=!view[type];refresh();});b.id='online-show-'+type;b.setAttribute('aria-controls','online-passages');
    const refresh=()=>{b.textContent=(view[type]?'Hide ':'Show ')+(type==='pinyin'?'pinyin':'English');b.setAttribute('aria-expanded',String(view[type]));rows.forEach(el=>el.hidden=!view[type]);};refresh();
   };toggle('pinyin',pinyin);toggle('english',english);
   const words=node('details',null,detail,'compact-help');words.id='online-word-tools';node('summary','Look up a word',words);const wordButtons=node('div',null,words,'online-words');
   for(const word of item.words){
    const b=button('Look up '+word,wordButtons,()=>{stop();HELP_LOOKUP_SESSION={owner:PR.cur,query:word,selected:new Set(),limit:24};showHomeworkLookup({back:()=>showOnlineLibrary({resume:item.id}),backLabel:'Back to reading'});},'chip');
    // The interface remains English; only the word itself is Chinese.
    b.replaceChildren(document.createTextNode('Look up '));const glyph=node('span',word,b);glyph.lang='zh-Hans';
   }
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
   const credits=node('details',null,detail,'compact-help online-source');credits.id='online-source';node('summary','Source & credits',credits);
   if(item.kind==='story'){
    node('p',item.authors[0]+' · Chinese translation: '+item.authors[1]+'.',credits);node('p','Original illustrations: '+item.illustrators+'. Illustrations omitted. Chinese text unchanged; English adapted and pinyin added by Mandarin Grove.',credits);link('Global Storybooks · original reading',item.sourceUrl,credits);link('English source reference',item.support.englishReference.url,credits);
   }else{
    node('p','Tatoeba contributors · Chinese: '+item.authors[0]+' · English: '+item.authors[1]+'. Text unchanged; pinyin added by Mandarin Grove.',credits);link('Original Chinese sentence',item.sourceUrl,credits);link('Original English sentence','https://tatoeba.org/en/sentences/show/'+item.translationId,credits);
   }
   link(item.license,library.licenseUrl(item.id),credits);node('p','Text aids prepared for these samples; teaching review pending.',credits,'reading-note');
   button('Report a problem with this reading',detail,report,'progress-link').id='online-report';
  }catch(error){
   if(!active()||token!==revision)return;current=null;status.remove();
   const message=node('p',error.message==='reading-changed'?'This source has changed. Please try another reading.':error.message==='reading-grade-unavailable'?'This reading includes characters beyond this grade. Please choose another sample.':'We could not load this reading. Try again, or open a saved reading.',detail,'reading-note');message.id='online-error';message.setAttribute('role','status');
   button('Try again',detail,()=>read(item)).id='online-retry';button('Report this loading problem',detail,report,'progress-link').id='online-report';
  }
 }
 list();if(resume){const item=items.find(i=>i.id===resume);if(item)read(item,true);}
}
