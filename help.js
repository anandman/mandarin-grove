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
function createHelpLookup(cards,wordIndex=null,examples=[]){
 const byText=new Map(),rows=[],byChar=new Map(cards.map(c=>[c.c,c]));
 for(const card of cards){
  const row={kind:'character',text:card.c,aliases:[card.c,...(wordIndex?.characterForms?.[card.c]||[])],readings:[{pinyin:card.p,meaning:card.m}],card};
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
 for(const row of rows){
  row.keys=row.readings.flatMap(r=>r.pinyin.split(/\s*\/\s*/).map(helpPinyinKey));
  row.meaning=row.readings.map(r=>r.meaning).join('; ');
  row.english=' '+row.meaning.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()+' ';
 }
 const exampleWords=[...new Set([...cards.flatMap(c=>(c.w||'').split('|')),...examples])].filter(w=>/^\p{Script=Han}{2,8}$/u.test(w));
 return {rows,byText,byChar,exampleWords};
}
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
  if(Number.isFinite(score))matches.push({row,score:score+(row.kind==='word'?.1:0)});
 }
 matches.sort((a,b)=>a.score-b.score||a.row.text.length-b.row.text.length);
 return {query,total:matches.length,items:matches.slice(0,Math.max(1,Math.min(240,limit))).map(x=>x.row)};
}
function helpLookupExamples(index,character){
 return index.exampleWords.filter(word=>word.includes(character)).slice(0,3).map(text=>index.byText.get(text)||{text});
}
function helpPracticeCharacters(index,texts){
 const chars=[];for(const text of texts)for(const ch of index.byText.get(text)?.text||text){const card=index.byChar.get(index.byText.get(ch)?.text||ch);if(card&&!chars.includes(card))chars.push(card);}
 return chars;
}

let HELP_LOOKUP_SESSION=null,HELP_DICTIONARY_SOURCE=null,HELP_DICTIONARY_CACHE=null;
function showHomeworkHelp(){
 screen();SESS=null;CRAM=null;delete document.body.dataset.study;
 A.innerHTML=`<section class="homework-help"><div class="writing-heading"><span class="writing-tree">${groveTree('writing')}</span><div><h1>Help</h1><p>A little help with your Chinese homework.</p></div></div><div class="grove-help-tools"><button class="grove-explore-card grove-lookup-entry" aria-label="Find a character or word" onclick="showHomeworkLookup()"><span class="grove-explore-icon" aria-hidden="true">${groveTree('unit')}</span><b>Find a character or word</b><small>Readings, meanings &amp; strokes · all grades</small></button>${writingIdeasHomeEntry()}<button class="grove-explore-card grove-writing-entry" aria-label="Plan a summary" onclick="showSummaryHelp()"><span class="grove-explore-icon" aria-hidden="true">${writingBook()}</span><b>Plan a summary</b><small>Main idea, key details &amp; your own words</small></button></div><button class="progress-link" onclick="home()">Back to your grove</button></section>`;
}
function showHomeworkLookup(){
 screen();SESS=null;CRAM=null;delete document.body.dataset.study;
 if(!HELP_LOOKUP_SESSION||HELP_LOOKUP_SESSION.owner!==PR.cur)HELP_LOOKUP_SESSION={owner:PR.cur,query:'',selected:new Set(),limit:24};
 const state=HELP_LOOKUP_SESSION,owner=PR.cur,examples=CHARACTER_IDEAS.map(e=>e.words[0]);
 let index=HELP_DICTIONARY_CACHE||createHelpLookup(ALL,null,examples),composing=false;
 A.innerHTML=`<section class="homework-lookup" id="homework-lookup" aria-labelledby="lookup-title"><div class="writing-heading"><span class="writing-tree">${groveTree('unit')}</span><div><h1 id="lookup-title">Find a character or word</h1><p>Look it up, then try it yourself.</p></div></div>
 <form id="lookup-form"><label for="lookup-input">Character, word, pinyin or English meaning</label><div class="lookup-search-row"><input id="lookup-input" type="search" maxlength="80" placeholder="学 · 学校 · xue2 · school" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-describedby="lookup-input-help"><button class="btn" id="lookup-search">Search</button></div><p class="reading-note" id="lookup-input-help">School characters from every grade, plus a word dictionary. Try nǚ, nv3 or nu:3 for 女.</p></form>
 <p class="reading-note" id="lookup-bank-status" role="status"></p><button class="progress-link" id="lookup-retry" hidden>Try loading the word dictionary again</button>
 <section id="lookup-detail" tabindex="-1" hidden></section><div id="lookup-matches"><p id="lookup-results-status" role="status"></p><div id="lookup-results"></div><button class="btn gray" id="lookup-more" hidden>Show more results</button></div>
 <div class="lookup-practice-bar"><span id="lookup-selection-count" role="status"></span><button class="btn" id="lookup-practice" disabled>Practice selected · 0</button><button class="progress-link" id="lookup-clear" hidden>Clear selection</button></div>
 <details class="compact-help"><summary>About this lookup</summary><p>Looking things up does not change your score, mastery or rewards. Practice selected opens the usual choices for a new round. Example words come from the school character list and Writing ideas vocabulary.</p><p>The word dictionary is CC-CEDICT, a general dictionary rather than a school vocabulary list. A missing entry does not mean a word is wrong. Dictionary searches run on this device after the bundled data loads; there is no live dictionary or model request. Audio uses your existing pronunciation setting.</p><a href="vendor/cc-cedict/LICENSE" target="_blank" rel="noopener">CC-CEDICT · MDBG and contributors · CC BY-SA 4.0</a></details><button class="progress-link" onclick="showHomeworkHelp()">Back to Help</button></section>`;
 const root=$('homework-lookup'),input=$('lookup-input'),detail=$('lookup-detail'),results=$('lookup-results');input.value=state.query;
 const active=()=>root.isConnected&&$('homework-lookup')===root&&PR.cur===owner;
 function updateSelection(){
  $('lookup-selection-count').textContent=state.selected.size?state.selected.size+' character'+(state.selected.size===1?'':'s')+' selected':'Choose characters from a result to practice.';
  $('lookup-practice').disabled=!state.selected.size;$('lookup-practice').textContent='Practice selected · '+state.selected.size;$('lookup-clear').hidden=!state.selected.size;
 }
 function renderResults(){
  const found=searchHelpLookup(index,state.query,state.limit);results.replaceChildren();
  $('lookup-results-status').textContent=!found.query?'Search for a character you forgot, a word, or its meaning.':found.total?'Showing '+found.items.length+' of '+found.total+' matches for “'+found.query+'”.':'No matches for “'+found.query+'”. Try another spelling or meaning.';
  $('lookup-more').hidden=found.items.length>=found.total||found.items.length>=240;
  for(const row of found.items){
   const button=document.createElement('button');button.type='button';button.className='lookup-result';button.dataset.lookupText=row.text;
   const word=document.createElement('b');word.lang='zh-Hans';word.textContent=row.text;
   const reading=document.createElement('span');reading.textContent=row.readings.map(r=>r.pinyin).join(' / ');
   const meaning=document.createElement('small');meaning.textContent=row.meaning;
   const source=document.createElement('small');source.className='lookup-source';source.textContent=row.kind==='character'?'School character':'Word dictionary';button.append(word,reading,meaning,source);button.onclick=()=>openResult(row);results.append(button);
  }
 }
 function search(value){state.query=value.trim();state.limit=24;detail.hidden=true;detail.replaceChildren();$('lookup-matches').hidden=false;feedbackQuestion=null;stopSpeech();renderResults();}
 function openResult(row){
  stopSpeech();detail.hidden=false;$('lookup-matches').hidden=true;detail.replaceChildren();
  const back=document.createElement('button');back.className='progress-link';back.textContent='Back to results';back.onclick=()=>{detail.hidden=true;detail.replaceChildren();$('lookup-matches').hidden=false;feedbackQuestion=null;stopSpeech();input.focus({preventScroll:true});};
  const title=document.createElement('h2');title.lang='zh-Hans';title.textContent=row.text;title.className='lookup-word';
  const source=document.createElement('p');source.className='reading-note';source.textContent=row.kind==='character'?'School character · '+GN[row.card.g?.[0]||'K']:'Word dictionary';detail.append(back,title,source);
  for(const r of row.readings){const p=document.createElement('p'),reading=document.createElement('strong'),meaning=document.createElement('span');reading.textContent=r.pinyin;meaning.textContent=r.meaning;p.className='lookup-reading';p.append(reading,meaning);detail.append(p);}
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
     const guide=HanziWriter.create(art,row.text,{width:size,height:size,padding:14,strokeColor:ink,strokeAnimationSpeed:1.2,delayBetweenStrokes:130,charDataLoader:(_,done)=>done(data)});status.textContent='';guide.animateCharacter();
    }catch{if(active()&&art.isConnected)status.textContent='The stroke guide could not load. You can try again.';}
    finally{if(strokes.isConnected)strokes.disabled=false;}
   };
   const words=helpLookupExamples(index,row.text);if(words.length){const heading=document.createElement('h3');heading.textContent='Words using '+row.text;detail.append(heading);const list=document.createElement('div');list.className='lookup-examples';for(const example of words){const button=document.createElement('button');button.className='btn gray';button.textContent=example.text;button.onclick=()=>{input.value=example.text;search(example.text);};list.append(button);}detail.append(list);}
  }
  const chars=helpPracticeCharacters(index,[row.text]);
  if(chars.length){const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Choose characters to practice';group.className='lookup-characters';group.append(legend);
   for(const card of chars){const label=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span');check.type='checkbox';check.dataset.lookupChar=card.c;check.checked=state.selected.has(card.c);text.lang='zh-Hans';text.textContent=card.c+' · '+card.p;check.onchange=()=>{if(check.checked)state.selected.add(card.c);else state.selected.delete(card.c);updateSelection();};label.append(check,text);group.append(label);}detail.append(group);
  }else{const note=document.createElement('p');note.className='reading-note';note.textContent='These characters are not in our school practice list yet.';detail.append(note);}
  feedbackQuestion={c:row.text,p:row.readings.map(r=>r.pinyin).join(' / ').slice(0,200),m:row.meaning.slice(0,400),mode:'lookup'};detail.focus({preventScroll:true});detail.scrollIntoView({block:'nearest'});
 }
 input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>composing=false);input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.isComposing||composing||e.keyCode===229))e.preventDefault();});
 $('lookup-form').onsubmit=e=>{e.preventDefault();if(!composing)search(input.value);};$('lookup-more').onclick=()=>{state.limit+=24;renderResults();};
 $('lookup-practice').onclick=()=>showStudySetup('practice',helpPracticeCharacters(index,[...state.selected]));
 $('lookup-clear').onclick=()=>{state.selected.clear();root.querySelectorAll('[data-lookup-char]').forEach(c=>c.checked=false);updateSelection();};
 async function load(){
  $('lookup-retry').hidden=true;$('lookup-bank-status').textContent='School characters ready. Loading the word dictionary…';
  try{
   const words=await loadWordBank();if(!active())return;
   if(HELP_DICTIONARY_SOURCE!==words){HELP_DICTIONARY_CACHE=createHelpLookup(ALL,words,examples);HELP_DICTIONARY_SOURCE=words;}
   index=HELP_DICTIONARY_CACHE;$('lookup-bank-status').textContent='School characters and word dictionary ready. Searches stay on this device.';$('lookup-bank-status').dataset.ready='true';renderResults();
  }catch{if(active()){$('lookup-bank-status').textContent='School characters work now. The word dictionary could not load.';$('lookup-retry').hidden=false;}}
 }
 $('lookup-retry').onclick=load;renderResults();updateSelection();load();
}
