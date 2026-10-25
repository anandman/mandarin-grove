// Homework lookup uses bundled curriculum and dictionary data, without learning evidence.
function helpPinyinKey(value){
 const numbered=String(value).toLowerCase().replace(/u:/g,'ü').replace(/([a-zü:]+)([1-5])/gi,(_,letters,tone)=>' '+pinyinWithMarks(letters+tone)+(tone==='5'?'·':'')+' ');
 const text=numbered.normalize('NFD').replace(/u\u0308/g,'v'),marks=['\u0304','\u0301','\u030c','\u0300'];
 let base='',start=0;const tones={},neutral=[];
 for(const ch of text){
  if(/[a-z]/.test(ch))base+=ch;
  else if(marks.includes(ch)&&base.length)tones[base.length-1]=marks.indexOf(ch)+1;
  else if(ch==='·')neutral.push([start,base.length]);
  else if(/[\s'’-]/.test(ch))start=base.length;
 }
 return {base,tones,neutral};
}
function helpPinyinMatches(key,query){
 return query.base&&key.base.startsWith(query.base)&&Object.entries(query.tones).every(([i,tone])=>key.tones[i]===tone)&&query.neutral.every(([start,end])=>!Object.keys(key.tones).some(i=>i>=start&&i<end));
}
function helpCharacterReadings(card){
 const evidence=card.readings?.flatMap(reading=>reading.evidence?.lines||[reading.evidence?.line].filter(Boolean))||[];
 if(card.c==='绿'&&evidence.some(line=>/\[lu:4\].*\/green\//.test(line)))return [{pinyin:card.p,meaning:'green'}];
 return [{pinyin:card.p,meaning:card.m}];
}
function helpFeedbackQuestion(row){
 const readings=row.displayReadings||row.readings;
 return {c:row.text,p:readings.map(r=>r.pinyin).join(' / ').slice(0,200),m:row.meaning.slice(0,400),mode:'lookup',...(row.content?{content:{...row.content}}:{})};
}
let HELP_VOCABULARY_PACK=null,HELP_VOCABULARY_PROMISE=null;
async function loadHelpVocabulary(fetcher=fetch){
 if(HELP_VOCABULARY_PACK)return HELP_VOCABULARY_PACK;
 if(!HELP_VOCABULARY_PROMISE)HELP_VOCABULARY_PROMISE=(async()=>{
  const response=await fetcher('content/elementary-vocabulary.json');if(!response.ok)throw Error('examples-unavailable');
  const pack=await response.json();
  const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u001f]/.test(value);
  const entries=pack?.entries,valid=Array.isArray(entries)&&entries.length>0&&entries.length<=1000&&new Set(entries.map(item=>item?.id)).size===entries.length&&entries.every(item=>item&&text(item.id,120)&&typeof item.word==='string'&&/^\p{Script=Han}{2,8}$/u.test(item.word)&&Array.isArray(item.aliases)&&item.aliases.every(alias=>typeof alias==='string'&&/^\p{Script=Han}{2,8}$/u.test(alias))&&text(item.pinyin,100)&&text(item.meaning,400)&&text(item.source?.id,100)&&item.source.license==='CC-BY-SA-4.0'&&text(item.status?.instructional,100));
  if(typeof GroveVocabulary==='undefined'||pack?.schemaVersion!==1||pack.id!=='grove-elementary-vocabulary'||!text(pack.version,40)||!valid)throw Error('examples-invalid');
  HELP_VOCABULARY_PACK=pack;return pack;
 })().finally(()=>{HELP_VOCABULARY_PROMISE=null;});
 return HELP_VOCABULARY_PROMISE;
}
function createHelpLookup(cards,wordIndex=null,examples=[],vocabularyPack=null){
 const byText=new Map(),rows=[],byChar=new Map(cards.map(c=>[c.c,c]));
 for(const card of cards){
  const row={kind:'character',text:card.c,aliases:[card.c,...(wordIndex?.characterForms?.[card.c]||[])],readings:helpCharacterReadings(card),card};
  rows.push(row);row.aliases.forEach(text=>byText.set(text,row));
 }
 if(wordIndex){
  const words=new Map(),seen=new Set();
  for(const entries of wordIndex.values())for(const entry of entries){
   if(seen.has(entry))continue;seen.add(entry);
   const [text,traditional,pinyin,meaning]=entry;
   let row=words.get(text);if(!row){row={kind:'word',text,aliases:[text],readings:[]};words.set(text,row);}
   if(traditional&&!row.aliases.includes(traditional))row.aliases.push(traditional);
   const marked=pinyinWithMarks(pinyin),reading=row.readings.find(r=>r.pinyin===marked);
   if(reading){if(!reading.meanings.includes(meaning))reading.meanings.push(meaning);}
   else row.readings.push({pinyin:marked,meanings:[meaning]});
  }
  for(const row of words.values()){
   row.readings=row.readings.map(r=>({pinyin:r.pinyin,meaning:r.meanings.join('; ')}));rows.push(row);row.aliases.forEach(text=>byText.set(text,row));
  }
 }
 const curatedWords=[];
 if(vocabularyPack&&typeof GroveVocabulary!=='undefined'){
  const query=GroveVocabulary.bind(vocabularyPack);
  for(const entry of vocabularyPack.entries){
   const item=query([...entry.word][0],{limit:40}).find(item=>item.id===entry.id);if(!item)continue;
   let row=byText.get(item.word);
   const reading={pinyin:pinyinWithMarks(item.pinyin),meaning:item.meaning};
   if(!row){row={kind:'word',text:item.word,aliases:[item.word,...item.aliases],readings:[reading]};rows.push(row);}
   row.example=item;row.displayReadings=[reading];row.content={packId:item.packId,itemId:item.id,version:item.packVersion,sourceId:item.source.id,reviewStatus:item.status.instructional};
   row.aliases.forEach(alias=>byText.set(alias,row));curatedWords.push(row.text);
  }
 }
 for(const row of rows){
  if(row.card?.source&&typeof GroveCurriculum!=='undefined')row.content={packId:GroveCurriculum.id,itemId:row.card.id||row.text,version:GroveCurriculum.version,sourceId:row.card.source.lexical,reviewStatus:row.card.source.review};
  row.keys=row.readings.flatMap(r=>r.pinyin.split(/\s*\/\s*/).map(helpPinyinKey));
  row.meaning=(row.displayReadings||row.readings).map(r=>r.meaning).join('; ');
  row.english=' '+row.readings.map(reading=>reading.meaning).join('; ').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()+' ';
 }
 const exampleWords=[...new Set([...cards.flatMap(c=>(c.w||'').split('|')),...examples])].filter(w=>/^\p{Script=Han}{2,8}$/u.test(w));
 return {rows,byText,byChar,exampleWords,curatedWords};
}
function helpSchoolResult(index,row){return row.kind==='character'||!!row.example||index.exampleWords.includes(row.text);}
function searchHelpLookup(index,value,limit=24){
 const query=String(value).trim(),empty={query,items:[],total:0};if(!query||query.length>80)return empty;
 const han=/^\p{Script=Han}+$/u.test(query),pinyin=helpPinyinKey(query),english=query.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),matches=[];
 for(const row of index.rows){
  let score=Infinity;
  if(row.aliases.includes(query))score=0;
  else if(han&&row.aliases.some(text=>text.includes(query)))score=10+row.text.length;
  if(!han){
   for(const key of row.keys)if(helpPinyinMatches(key,pinyin))score=Math.min(score,key.base===pinyin.base?2:12+key.base.length);
   if(english&&row.english.includes(' '+english+' '))score=Math.min(score,row.english.trim()===english?4:8);
  }
  if(Number.isFinite(score))matches.push({row,rank:row.aliases.includes(query)?0:row.kind==='character'?1:helpSchoolResult(index,row)?2:3,score:score+(row.kind==='word'?.1:0)});
 }
 matches.sort((a,b)=>a.rank-b.rank||a.score-b.score||a.row.text.length-b.row.text.length);
 return {query,total:matches.length,items:matches.slice(0,Math.max(1,Math.min(240,limit))).map(x=>x.row)};
}
function helpLookupExamples(index,character){
 return [...new Set([...(index.curatedWords||[]),...index.exampleWords])].filter(word=>word.includes(character)||index.byText.get(word)?.aliases.some(alias=>alias.includes(character))).slice(0,3).map(text=>index.byText.get(text)||{text});
}
function helpPracticeCharacters(index,texts){
 const chars=[];for(const text of texts)for(const ch of index.byText.get(text)?.text||text){const card=index.byChar.get(index.byText.get(ch)?.text||ch);if(card&&!chars.includes(card))chars.push(card);}
 return chars;
}

let HELP_LOOKUP_SESSION=null,HELP_DICTIONARY_SOURCE=null,HELP_DICTIONARY_CACHE=null,HELP_DICTIONARY_PACK=null;
function showHomeworkHelp(){
 screen();SESS=null;CRAM=null;delete document.body.dataset.study;
 A.innerHTML=`<section class="homework-help"><div class="writing-heading"><span class="writing-tree">${groveTree('writing')}</span><div><h1>Help</h1><p>A little help with your Chinese homework.</p></div></div><div class="grove-help-tools"><button class="grove-explore-card grove-lookup-entry" aria-label="Find a character or word" onclick="showHomeworkLookup()"><span class="grove-explore-icon" aria-hidden="true">${groveTree('unit')}</span><b>Find a character or word</b><small>Readings, meanings &amp; strokes · all grades</small></button>${writingIdeasHomeEntry()}<button class="grove-explore-card grove-writing-entry" aria-label="Plan a summary" onclick="showSummaryHelp()"><span class="grove-explore-icon" aria-hidden="true">${writingBook()}</span><b>Plan a summary</b><small>Main idea, key details &amp; your own words</small></button><button class="grove-explore-card grove-writing-entry" aria-label="Online reading" onclick="showOnlineLibrary()"><span class="grove-explore-icon" aria-hidden="true">${writingBook()}</span><b>Online reading</b><small>Selected short readings &amp; sentences</small></button></div><button class="progress-link" onclick="home()">Back to your grove</button></section>`;
}
function showHomeworkLookup(){
 screen();SESS=null;CRAM=null;delete document.body.dataset.study;
 if(!HELP_LOOKUP_SESSION||HELP_LOOKUP_SESSION.owner!==PR.cur)HELP_LOOKUP_SESSION={owner:PR.cur,query:'',selected:new Set(),limit:24};
 const state=HELP_LOOKUP_SESSION,owner=PR.cur,examples=CHARACTER_IDEAS.map(e=>e.words[0]);
 let index=HELP_DICTIONARY_CACHE||createHelpLookup(ALL,null,examples,HELP_VOCABULARY_PACK),composing=false,shown=null,bankReady=!!HELP_DICTIONARY_SOURCE;
 A.innerHTML=`<section class="homework-lookup" id="homework-lookup" aria-labelledby="lookup-title"><div class="writing-heading"><span class="writing-tree">${groveTree('unit')}</span><div><h1 id="lookup-title">Find a character or word</h1><p>Look it up, then try it yourself.</p></div></div>
 <form id="lookup-form"><label for="lookup-input">Character, word, pinyin or English meaning</label><div class="lookup-search-row"><input id="lookup-input" type="search" maxlength="80" placeholder="学 · 学校 · xue2 · school" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-describedby="lookup-input-help"><button class="btn" id="lookup-search">Search</button></div><p class="reading-note" id="lookup-input-help">School characters from every grade, plus a word dictionary. Try nǚ, nv3 or nu:3 for 女.</p></form>
 <p class="reading-note" id="lookup-bank-status" role="status"></p><button class="progress-link" id="lookup-retry" hidden>Try loading the word dictionary again</button>
 <p class="reading-note" id="lookup-examples-status" role="status"></p><button class="progress-link" id="lookup-examples-retry" hidden>Try loading examples again</button>
 <section id="lookup-detail" tabindex="-1" hidden></section><div id="lookup-matches"><p id="lookup-results-status" role="status"></p><div id="lookup-feedback-offer"></div><div id="lookup-results"></div><button class="btn gray" id="lookup-more" hidden>Show more results</button></div>
 <div class="lookup-practice-bar"><span id="lookup-selection-count" role="status"></span><button class="btn" id="lookup-practice" disabled>Practice selected · 0</button><button class="progress-link" id="lookup-clear" hidden>Clear selection</button></div>
 <details class="compact-help"><summary>About this lookup</summary><p>Looking things up does not change your score, mastery or rewards. Practice selected opens the usual choices for a new round. Examples include a small CC-CEDICT vocabulary pack and Writing ideas vocabulary. Dictionary-sourced examples are awaiting teaching review. Optional draft ideas are ungraded; they do not check a child’s sentence.</p><p>The word dictionary is CC-CEDICT, a general dictionary rather than a school vocabulary list. A missing entry does not mean a word is wrong. Dictionary searches run on this device after the bundled data loads; there is no live dictionary or model request. Audio uses your existing pronunciation setting.</p><a href="vendor/cc-cedict/LICENSE" target="_blank" rel="noopener">CC-CEDICT · MDBG and contributors · CC BY-SA 4.0</a></details><button class="progress-link" onclick="showHomeworkHelp()">Back to Help</button></section>`;
 const root=$('homework-lookup'),input=$('lookup-input'),detail=$('lookup-detail'),results=$('lookup-results');input.value=state.query;
 const active=()=>root.isConnected&&$('homework-lookup')===root&&PR.cur===owner;
 function updateSelection(){
  $('lookup-selection-count').textContent=state.selected.size?state.selected.size+' character'+(state.selected.size===1?'':'s')+' selected':'Choose characters from a result to practice.';
  $('lookup-practice').disabled=!state.selected.size;$('lookup-practice').textContent='Practice selected · '+state.selected.size;$('lookup-clear').hidden=!state.selected.size;
 }
 function renderResults(){
  const focused=results.contains(document.activeElement)?{text:document.activeElement?.dataset.lookupText,summary:document.activeElement?.matches('#lookup-dictionary > summary')}:null;
  const found=searchHelpLookup(index,state.query,state.limit);results.replaceChildren();
  const school=document.createElement('section');school.id='lookup-school-results';
  const general=document.createElement('details');general.id='lookup-dictionary';general.open=!!state.dictionaryOpen||!found.items.some(row=>helpSchoolResult(index,row));
  general.ontoggle=()=>{if(general.isConnected)state.dictionaryOpen=general.open;};
  const summary=document.createElement('summary');summary.textContent='Full dictionary · more words and meanings';
  const dictionary=document.createElement('div');dictionary.id='lookup-dictionary-results';general.append(summary,dictionary);
  if(found.items.some(row=>helpSchoolResult(index,row))){const heading=document.createElement('h2');heading.textContent='School characters & example words';school.append(heading);}results.append(school);
  if(found.items.some(row=>!helpSchoolResult(index,row)))results.append(general);
  $('lookup-results-status').textContent=!found.query?'Search for a character you forgot, a word, or its meaning.':found.total?'Showing '+found.items.length+' of '+found.total+' match'+(found.total===1?'':'es')+' for “'+found.query+'”. School characters and examples appear first.'+(found.items.length<found.total?(found.items.length>=240?' To see other matches, narrow your search.':' Choose Show more for more results.'):''):'No matches for “'+found.query+'”. Try another spelling or meaning.';
  contentFeedbackOffer($('lookup-feedback-offer'),bankReady&&input.value.trim()===state.query&&found.query&&!found.total?{label:'Suggest a missing entry',message:'You can suggest a character or word for the lookup.',note:'Lookup did not find a match.\nSearch: '+found.query}:null,input);
  $('lookup-more').hidden=found.items.length>=found.total||found.items.length>=240;
  for(const row of found.items){
   const button=document.createElement('button');button.type='button';button.className='lookup-result';button.dataset.lookupText=row.text;
   const word=document.createElement('b');word.lang='zh-Hans';word.textContent=row.text;
   const reading=document.createElement('span');reading.lang='zh-Latn-pinyin';reading.textContent=row.readings.map(r=>r.pinyin).join(' / ');
   const meaning=document.createElement('small');meaning.textContent=row.meaning;
   const source=document.createElement('small');source.className='lookup-source';source.textContent=row.kind==='character'?'School character':row.example?'Example · teaching review pending':helpSchoolResult(index,row)?'Writing ideas word':'Full dictionary';button.append(word,reading,meaning,source);button.onclick=()=>openResult(row);(helpSchoolResult(index,row)?school:dictionary).append(button);
  }
  if(focused){const target=focused.summary?results.querySelector('#lookup-dictionary > summary'):[...results.querySelectorAll('[data-lookup-text]')].find(el=>el.dataset.lookupText===focused.text);(target||input).focus();}
 }
 function search(value){shown=null;state.query=value.trim();state.limit=24;state.dictionaryOpen=false;detail.hidden=true;detail.replaceChildren();$('lookup-matches').hidden=false;feedbackQuestion=null;stopSpeech();renderResults();}
 function openResult(row,focus=true){
  shown=row;if(focus)stopSpeech();detail.hidden=false;$('lookup-matches').hidden=true;detail.replaceChildren();
  const back=document.createElement('button');back.className='progress-link';back.textContent='Back to results';back.onclick=()=>{shown=null;detail.hidden=true;detail.replaceChildren();$('lookup-matches').hidden=false;feedbackQuestion=null;stopSpeech();input.focus();input.scrollIntoView({block:'center'});};
  const title=document.createElement('h2');title.lang='zh-Hans';title.textContent=row.text;title.className='lookup-word';
  const source=document.createElement('p');source.className='reading-note';source.textContent=row.kind==='character'?'School character · '+GN[row.card.g?.[0]||'K']:'Word dictionary';detail.append(back,title,source);
  for(const r of row.displayReadings||row.readings){const p=document.createElement('p'),reading=document.createElement('strong'),meaning=document.createElement('span');reading.lang='zh-Latn-pinyin';reading.textContent=r.pinyin;meaning.textContent=r.meaning;p.className='lookup-reading';p.append(reading,meaning);detail.append(p);}
  const actions=document.createElement('div');actions.className='lookup-detail-actions';const hear=document.createElement('button');hear.className='btn';hear.textContent='Hear pronunciation';hear.onclick=()=>say(row.text);actions.append(hear);detail.append(actions);
  if(row.kind==='character'){
   const strokes=document.createElement('button');strokes.className='btn gray';strokes.textContent='Watch strokes';actions.append(strokes);
   const art=document.createElement('div');art.id='lookup-strokes';art.hidden=true;const status=document.createElement('p');status.className='reading-note';status.setAttribute('role','status');detail.append(art,status);
   strokes.onclick=async()=>{
    strokes.disabled=true;art.hidden=false;status.textContent='Loading strokes…';
    try{
     let data=STROKES[row.text];if(!data){const response=await fetch('strokes/'+encodeURIComponent(row.text)+'.json');if(!response.ok)throw Error('unavailable');data=await response.json();}
     if(!active()||!art.isConnected)return;
     art.replaceChildren();const size=Math.min(240,art.clientWidth||240),ink=getComputedStyle(document.body).getPropertyValue('--paper-ink').trim()||'#1F2937';
     const guide=WritingSurface.create(art,row.text,{width:size,height:size,padding:14,strokeColor:ink,strokeAnimationSpeed:1.2,delayBetweenStrokes:130,charDataLoader:(_,done)=>done(data)});status.textContent='';guide.animateCharacter();
    }catch{if(active()&&art.isConnected)status.textContent='The stroke guide could not load. You can try again.';}
    finally{if(strokes.isConnected)strokes.disabled=false;}
   };
   const examplesRoot=document.createElement('section');examplesRoot.id='lookup-word-examples';detail.append(examplesRoot);renderExamples(row.text,examplesRoot);
  }
  if(row.example){
   const note=document.createElement('p');note.className='reading-note';note.textContent='CC-CEDICT · MDBG and contributors · teaching review pending';detail.append(note);
   const credit=document.createElement('a');credit.href='vendor/cc-cedict/LICENSE';credit.target='_blank';credit.rel='noopener';credit.textContent='Source and CC BY-SA 4.0 license';detail.append(credit);
   const idea=row.example.writingIdea;if(idea?.graded===false&&idea.status==='agent-authored-draft'){
    const disclosure=document.createElement('details'),summary=document.createElement('summary'),text=document.createElement('p'),status=document.createElement('p');disclosure.className='compact-help';summary.textContent='Try a writing idea (draft)';text.textContent=idea.text;status.className='reading-note';status.textContent='An AI-assisted draft, awaiting teaching review. Use your own words; this idea is ungraded.';disclosure.append(summary,text,status);detail.append(disclosure);
   }
  }
  if(row.content){const report=document.createElement('button');report.className='progress-link';report.textContent=row.example?'Report this example':'Report this entry';report.onclick=()=>{feedbackQuestion=helpFeedbackQuestion(row);showFeedback();};detail.append(report);}
  const chars=helpPracticeCharacters(index,[row.text]);
  if(chars.length){const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Choose characters to practice';group.className='lookup-characters';group.append(legend);
   for(const card of chars){const label=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span');check.type='checkbox';check.dataset.lookupChar=card.c;check.checked=state.selected.has(card.c);text.lang='zh-Hans';text.textContent=card.c+' · '+card.p;check.onchange=()=>{if(check.checked)state.selected.add(card.c);else state.selected.delete(card.c);updateSelection();};label.append(check,text);group.append(label);}detail.append(group);
  }else{const note=document.createElement('p');note.className='reading-note';note.textContent='These characters are not in our school practice list yet.';detail.append(note);}
  feedbackQuestion=helpFeedbackQuestion(row);if(focus){detail.focus({preventScroll:true});detail.scrollIntoView({block:'nearest'});}
 }
 function renderExamples(character,target){
  target.replaceChildren();const words=helpLookupExamples(index,character);if(!words.length)return;
  const heading=document.createElement('h3');heading.textContent='Words using '+character;target.append(heading);
  const list=document.createElement('div');list.className='lookup-examples';
  for(const example of words){const button=document.createElement('button');button.className='btn gray';button.textContent=example.text;button.onclick=()=>{input.value=example.text;const entry=index.byText.get(example.text);if(entry)openResult(entry);else search(example.text);};list.append(button);}target.append(list);
 }
 function rebuildIndex(){
  HELP_DICTIONARY_CACHE=createHelpLookup(ALL,HELP_DICTIONARY_SOURCE,examples,HELP_VOCABULARY_PACK);HELP_DICTIONARY_PACK=HELP_VOCABULARY_PACK;index=HELP_DICTIONARY_CACHE;renderResults();
  if(shown?.kind==='character'&&$('lookup-word-examples'))renderExamples(shown.text,$('lookup-word-examples'));
  else if(shown?.kind==='word'){
   const updated=index.byText.get(shown.text);
   if(updated){
    const display=row=>JSON.stringify([row.displayReadings||row.readings,row.content,row.example?.writingIdea]);
    if(display(updated)!==display(shown)){
     const focused=document.activeElement,inside=detail.contains(focused),character=focused?.dataset.lookupChar,tag=focused?.tagName,label=focused?.textContent;
     openResult(updated,false);
     if(inside){const replacement=[...detail.querySelectorAll('button,a,input,summary')].find(node=>character?node.dataset.lookupChar===character:node.tagName===tag&&node.textContent===label);replacement?.focus({preventScroll:true});}
    }else{shown=updated;feedbackQuestion=helpFeedbackQuestion(updated);}
   }
  }
 }
 async function loadExamples(){
  if(document.activeElement===$('lookup-examples-retry'))input.focus();$('lookup-examples-retry').hidden=true;$('lookup-examples-status').textContent='Loading optional example words…';
  try{await loadHelpVocabulary();if(!active())return;rebuildIndex();$('lookup-examples-status').textContent='Dictionary examples ready · teaching review pending.';$('lookup-examples-status').dataset.ready='true';}
  catch{if(active()){$('lookup-examples-status').textContent='Optional examples could not load. The lookup still works.';$('lookup-examples-retry').hidden=false;}}
 }
 input.addEventListener('input',()=>contentFeedbackOffer($('lookup-feedback-offer'),null,input));
 input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>composing=false);input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.isComposing||composing||e.keyCode===229))e.preventDefault();});
 $('lookup-form').onsubmit=e=>{e.preventDefault();if(!composing)search(input.value);};$('lookup-more').onclick=()=>{state.limit+=24;renderResults();};
 $('lookup-practice').onclick=()=>showStudySetup('practice',helpPracticeCharacters(index,[...state.selected]));
 $('lookup-clear').onclick=()=>{state.selected.clear();root.querySelectorAll('[data-lookup-char]').forEach(c=>c.checked=false);updateSelection();};
 async function load(){
  if(document.activeElement===$('lookup-retry'))input.focus();$('lookup-retry').hidden=true;$('lookup-bank-status').textContent='School characters ready. Loading the word dictionary…';
  try{
   const words=await loadWordBank();if(!active())return;
   if(!HELP_DICTIONARY_CACHE||HELP_DICTIONARY_SOURCE!==words||HELP_DICTIONARY_PACK!==HELP_VOCABULARY_PACK){HELP_DICTIONARY_SOURCE=words;rebuildIndex();}
   bankReady=true;index=HELP_DICTIONARY_CACHE;$('lookup-bank-status').textContent='School characters and word dictionary ready. Searches stay on this device.';$('lookup-bank-status').dataset.ready='true';renderResults();
  }catch{if(active()){$('lookup-bank-status').textContent='School characters work now. The word dictionary could not load.';$('lookup-retry').hidden=false;}}
 }
 $('lookup-retry').onclick=load;$('lookup-examples-retry').onclick=loadExamples;renderResults();updateSelection();load();loadExamples();
}
