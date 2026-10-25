// Selected online readings. Public content cache is separate from all child records.
let ONLINE_READING_CLIENT=null;
function showOnlineLibrary(){
 screen();SESS=null;CRAM=null;delete document.body.dataset.study;feedbackQuestion=null;
 const owner=PR.cur,library=ONLINE_READING_CLIENT||(ONLINE_READING_CLIENT=GroveOnlineContent.createLibrary(GROVE_ONLINE_LIBRARY));
 A.innerHTML=`<section class="online-library" id="online-library" aria-labelledby="online-title"><div class="writing-heading"><span class="writing-tree" aria-hidden="true">${writingBook()}</span><div><h1 id="online-title">Online reading</h1><p>Short readings to explore. No score or answer checking.</p></div></div><p class="reading-note" id="online-network-note">Read online loads text from Global Storybooks or Tatoeba. Your name, writing and progress stay on this device.</p><div id="online-panel"></div><details class="compact-help"><summary>About these readings &amp; privacy</summary><p>This small pilot uses selected simplified Chinese text. Teaching review is still pending; these are not school-grade levels or quiz answers. Ask a grown-up about unfamiliar words. No new recordings are included.</p><p>Opening an unsaved reading sends its item number or file path to its text provider. The provider sees normal connection details, including your IP address. We do not send names, drafts or learning history. Source websites opened through the credit links have their own privacy policies.</p><p>Save for offline keeps a public reading on this browser, shared between children. Saved readings are separate from progress backups. Your browser may clear them. Offline reading needs the app to be open or already loaded; saving a reading does not install the app for offline launch.</p><a href="content/online-reading-notices.txt" target="_blank" rel="noopener noreferrer">Source credits &amp; licenses</a></details><button class="progress-link" id="online-help-back">Back to Help</button></section>`;
 const root=$('online-library'),panel=$('online-panel');let current=null,revision=0;
 root.addEventListener('keydown',feedbackButtonKeydown);
 const active=()=>root.isConnected&&$('online-library')===root&&PR.cur===owner;
 const stop=()=>{revision++;current?.abort();current=null;};
 const observer=new MutationObserver(()=>{if(!active()){stop();observer.disconnect();}});observer.observe(A,{childList:true});
 $('online-help-back').onclick=()=>{stop();showHomeworkHelp();};
 function node(tag,value,parent,cls){const el=document.createElement(tag);if(value)el.textContent=value;if(cls)el.className=cls;if(parent)parent.append(el);return el;}
 function button(label,parent,action,cls='btn gray'){const b=node('button',label,parent,cls);b.type='button';b.onclick=action;return b;}
 function link(label,url,parent){const a=node('a',label,parent);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
 function list(focusId){
  stop();feedbackQuestion=null;panel.replaceChildren();
  for(const [kind,label]of [['story','Stories & short readings'],['sentence','Everyday sentences']]){
   const section=node('section',null,panel);node('h2',label,section);const grid=node('div',null,section,'online-grid');
   for(const item of library.list().filter(i=>i.kind===kind)){
    const card=node('article',null,grid,'online-card'),heading=node('h3',item.title,card);if(kind==='story')heading.lang='zh-Hans';
    if(item.subtitle)node('p',item.subtitle,card,'reading-note');node('p',kind==='story'?'Global Storybooks · short reading':'Tatoeba · one sentence',card,'reading-note');
    const status=node('p','Needs internet',card,'reading-note');status.dataset.saved=item.id;
    const b=button('Read online',card,()=>read(item));b.dataset.reading=item.id;b.setAttribute('aria-label','Read online · '+item.title);
    library.isSaved(item.id).then(saved=>{if(!active()||!card.isConnected)return;if(saved){status.textContent='Saved on this browser';b.textContent='Read saved copy';b.setAttribute('aria-label','Read saved copy · '+item.title);}}).catch(()=>{});
    if(item.id===focusId)b.focus();
   }
  }
 }
 async function read(item){
  stop();const token=revision;current=new AbortController();const signal=current.signal;
  panel.replaceChildren();const detail=node('section',null,panel);detail.id='online-detail';
  const heading=node('h2',item.title,detail);heading.tabIndex=-1;if(item.kind==='story')heading.lang='zh-Hans';heading.focus();
  const status=node('p','Loading this reading…',detail,'reading-note');status.setAttribute('role','status');
  const cancel=button('Cancel loading',detail,()=>list(item.id));cancel.id='online-cancel';
  button('Back to readings',detail,()=>list(item.id),'progress-link').id='online-list-back';
  const context={content:{packId:'grove-online-reading',itemId:item.id,version:library.version,sourceId:item.sourceId,reviewStatus:item.reviewStatus}};
  feedbackQuestion=context;
  const report=()=>showFeedback({category:'meaning',note:'Reading: '+item.title+'\nItem: '+item.id,context});
  try{
   const result=await library.read(item.id,{signal});if(!active()||token!==revision)return;current=null;status.remove();cancel.remove();
   const passages=node('div',null,detail,'online-passages');passages.id='online-passages';passages.lang='zh-Hans';for(const p of result.paragraphs)node('p',p,passages);
   if(result.translation.length){const translations=node('details',null,detail,'compact-help');translations.id='online-translation';node('summary','Show English meaning',translations);for(const p of result.translation){const line=node('p',p,translations);line.lang='en';}}
   const words=node('div',null,detail,'online-words');node('p','Words to explore in the on-device dictionary:',words,'reading-note');
   for(const word of item.words)button('Look up '+word,words,()=>{stop();HELP_LOOKUP_SESSION={owner:PR.cur,query:word,selected:new Set(),limit:24};showHomeworkLookup();},'chip').lang='zh-Hans';
   const saveStatus=node('p',result.saved?'Saved copy · available without internet while the app is loaded.':'Read online. You can save this reading for offline use.',detail,'reading-note');saveStatus.id='online-save-status';saveStatus.setAttribute('role','status');
   const controls=node('div',null,detail,'online-actions');
   const save=button('Save for offline',controls,async()=>{
    save.disabled=true;remove.disabled=true;
    try{await library.save(item.id,result);if(!active()||token!==revision)return;saveStatus.textContent='Saved for offline on this browser.';save.hidden=true;remove.hidden=false;remove.disabled=false;remove.focus();}
    catch{if(active()&&token===revision)saveStatus.textContent='Could not save this reading. You can still read it here; try saving again.';}
    finally{if(active()&&token===revision){save.disabled=false;remove.disabled=false;}}
   });save.id='online-save';save.hidden=result.saved;
   const remove=button('Remove saved copy',controls,async()=>{
    save.disabled=true;remove.disabled=true;
    try{await library.remove(item.id);if(!active()||token!==revision)return;saveStatus.textContent='Removed the saved copy. This reading is still open; next time it will need internet.';remove.hidden=true;save.hidden=false;save.disabled=false;save.focus();}
    catch{if(active()&&token===revision)saveStatus.textContent='Could not remove the saved copy. Try again.';}
    finally{if(active()&&token===revision){save.disabled=false;remove.disabled=false;}}
   });remove.id='online-remove';remove.hidden=!result.saved;
   button('Report a problem with this reading',controls,report,'progress-link').id='online-report';
   const credits=node('div',null,detail,'online-source');credits.id='online-source';node('h3','Source & credits',credits);
   if(item.kind==='story'){
    node('p',item.authors[0]+' · Chinese translation: '+item.authors[1]+'.',credits);node('p','Original illustrations: '+item.illustrators+'. Illustrations omitted; text unchanged, paragraph formatting adapted.',credits);link('Global Storybooks · original reading',item.sourceUrl,credits);
   }else{
    node('p','Tatoeba contributors · Chinese: '+item.authors[0]+' · English: '+item.authors[1]+'. Text unchanged.',credits);link('Original Chinese sentence',item.sourceUrl,credits);link('Original English sentence','https://tatoeba.org/en/sentences/show/'+item.translationId,credits);
   }
   link(item.license,library.licenseUrl(item.id),credits);node('p','Selected for this pilot; teaching review pending. Reading does not change progress or rewards.',credits,'reading-note');
  }catch(error){
   if(!active()||token!==revision)return;current=null;cancel.remove();status.remove();
   const message=node('p',error.message==='reading-changed'?'This source has changed since we selected it. We could not verify this version; try another reading.':'We could not load this reading. Check your connection, or try a saved reading. Your progress is unchanged.',detail,'reading-note');message.id='online-error';message.setAttribute('role','status');
   button('Try loading again',detail,()=>read(item)).id='online-retry';button('Report this loading problem',detail,report,'progress-link').id='online-report';
  }
 }
 list();
}
