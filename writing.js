// Local Writing Spark ideas; source data and MIT notice are in vendor/writing-spark.
function writingIdeasLookup(value){
 const input=value.trim();
 if(!/^\p{Script=Han}+$/u.test(input))return {input,cards:[],error:'Type a Chinese character or word, without spaces or punctuation.'};
 const cards=ideasForText(input);
 return {input,cards,error:cards.length?'':'We do not have an idea for that character or whole word yet. Try another, or browse below.'};
}
function createWritingIdeaDecks(random=Math.random){
 const decks=new Map(),previous=new Map();
 return {next(input,cards){
  if(!cards.length)return null;
  let deck=decks.get(input);
  if(!deck?.length){
   deck=cards.slice();
   for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
   decks.set(input,deck);
  }
  const last=previous.get(input);
  let choices=deck.filter(card=>card.word!==last?.word);
  if(!choices.length)choices=deck.filter(card=>card.text!==last?.text);
  if(!choices.length)choices=deck;
  // Balance related words without repeating a card before the deck is exhausted.
  const counts=new Map();for(const card of choices)counts.set(card.word,(counts.get(card.word)||0)+1);
  const largest=Math.max(...counts.values()),words=[...counts].filter(([,n])=>n===largest).map(([word])=>word);
  const word=words[Math.floor(random()*words.length)],card=choices.find(card=>card.word===word);
  deck.splice(deck.indexOf(card),1);previous.set(input,card);return card;
 }};
}
function writingBrowseEntries(kind,query=''){
 const q=query.trim().toLowerCase();
 if(kind==='characters')return [...new Set(CHARACTER_IDEAS.flatMap(entry=>[...entry.words[0]]))].sort().filter(value=>!q||value.includes(q)).map(value=>({value,meaning:''}));
 return CHARACTER_IDEAS.filter(entry=>!q||entry.words.some(word=>word.includes(q))||entry.meaning.toLowerCase().includes(q)).map(entry=>({value:entry.words[0],meaning:entry.meaning}));
}

let WRITING_IDEAS_SESSION=null;
function writingIdeasSession(){
 if(!WRITING_IDEAS_SESSION||WRITING_IDEAS_SESSION.owner!==PR.cur)WRITING_IDEAS_SESSION={owner:PR.cur,input:'',card:null,claim:null,decks:createWritingIdeaDecks()};
 return WRITING_IDEAS_SESSION;
}
function writingBook(){
 return '<svg viewBox="0 0 100 70" aria-hidden="true"><path d="M9 12Q29 5 50 18Q71 5 91 12V57Q70 50 50 63Q30 50 9 57Z" fill="#AD96DC" stroke="#583C85" stroke-width="3" stroke-linejoin="round"/><path d="M50 18V63M19 25Q32 23 41 29M19 36Q32 34 41 40M59 29Q72 23 82 25M59 40Q72 34 82 36" fill="none" stroke="#F4F1EA" stroke-width="3" stroke-linecap="round"/></svg>';
}
function writingIdeasHomeEntry(){
 return `<button class="grove-explore-card grove-writing-entry" onclick="showWritingIdeas()"><span class="grove-explore-icon" aria-hidden="true">${writingBook()}</span><b>Writing ideas</b><small>A seed for a sentence</small></button>`;
}
function showHomeworkHelp(){
 screen();SESS=null;CRAM=null;delete document.body.dataset.study;
 A.innerHTML=`<section class="homework-help"><div class="writing-heading"><span class="writing-tree">${groveTree('writing')}</span><div><h1>Help</h1><p>A little help with your Chinese homework.</p></div></div><div class="grove-help-tools">${writingIdeasHomeEntry()}</div><button class="progress-link" onclick="home()">Back to your grove</button></section>`;
}
function showWritingIdeas(){
 screen();SESS=null;CRAM=null;
 const state=writingIdeasSession();
 A.innerHTML=`<section class="writing-ideas" aria-labelledby="writing-title">
  <div class="writing-heading"><span class="writing-tree">${groveTree('writing')}</span><div><h1 id="writing-title">Writing ideas</h1><p>A small idea to get your own sentence growing.</p></div></div>
  <div class="writing-input-panel"><label for="writing-input">Character or word</label><div class="writing-input-row"><input id="writing-input" lang="zh-Hans" type="text" placeholder="雨、学校、检查" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-describedby="writing-input-help writing-status"><button class="btn" id="writing-generate">Give me an idea</button></div><p id="writing-input-help" class="reading-note">Type a character or a whole word, like 雨, 学校, or 检查.</p><p id="writing-status" role="status"></p></div>
  <div id="writing-result" aria-live="polite" aria-atomic="true"></div>
  <details class="writing-browse" id="writing-browse"><summary>Browse available characters &amp; words</summary><div class="writing-browse-controls"><label>Browse <select id="writing-browse-kind"><option value="words">Words</option><option value="characters">Characters</option></select></label><label>Find <input type="search" id="writing-browse-search" placeholder="Character, word, or meaning" autocomplete="off"></label></div><p class="reading-note" id="writing-browse-count" role="status"></p><div id="writing-browse-list" class="writing-browse-list"></div><button class="btn gray" id="writing-browse-more">Show more</button></details>
  <p class="reading-note writing-attribution">Local ideas from Writing Spark · <a href="vendor/writing-spark/LICENSE" target="_blank" rel="noopener">MIT license</a></p>
  <button class="progress-link" onclick="showHomeworkHelp()">Back to Help</button>
 </section>`;
 const input=$('writing-input');input.value=state.input;
 let composing=false;
 input.addEventListener('compositionstart',()=>{composing=true;});
 input.addEventListener('compositionend',()=>{composing=false;});
 input.addEventListener('input',()=>{state.input=input.value;state.card=null;state.claim=null;$('writing-status').textContent='';renderWritingIdea();});
 input.addEventListener('keydown',event=>{
  if(event.key!=='Enter'||event.isComposing||composing||event.keyCode===229)return;
  event.preventDefault();generateWritingIdea();
 });
 $('writing-generate').onclick=generateWritingIdea;
 let browseLimit=30;
 const browse=()=>{
  const entries=writingBrowseEntries($('writing-browse-kind').value,$('writing-browse-search').value),list=$('writing-browse-list');
  list.replaceChildren();
  for(const entry of entries.slice(0,browseLimit)){
   const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','Use '+entry.value);
   const word=document.createElement('span');word.lang='zh-Hans';word.textContent=entry.value;button.append(word);
   if(entry.meaning){const meaning=document.createElement('small');meaning.textContent=entry.meaning;button.append(meaning);}
   button.onclick=()=>{input.value=entry.value;state.input=entry.value;generateWritingIdea();$('writing-browse').open=false;$('writing-another').focus();};
   list.append(button);
  }
  $('writing-browse-count').textContent=entries.length?`Showing ${Math.min(entries.length,browseLimit)} of ${entries.length}. Choose one for an idea.`:'No matches. Try another search.';
  $('writing-browse-more').hidden=entries.length<=browseLimit;
 };
 $('writing-browse-kind').onchange=()=>{browseLimit=30;browse();};
 $('writing-browse-search').oninput=()=>{browseLimit=30;browse();};
 $('writing-browse-more').onclick=()=>{browseLimit+=30;browse();};
 browse();renderWritingIdea();
}
function generateWritingIdea(){
 const state=writingIdeasSession(),lookup=writingIdeasLookup($('writing-input').value);
 state.input=$('writing-input').value;state.card=null;state.claim=null;
 $('writing-status').textContent=lookup.error;
 if(!lookup.error){
  state.card=state.decks.next(lookup.input,lookup.cards);
  state.claim={id:globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),done:false};
 }
 renderWritingIdea();
}
function renderWritingIdea(){
 const state=writingIdeasSession(),result=$('writing-result');
 const focused=document.activeElement?.id;
 feedbackQuestion=state.card?{mode:'writing-ideas',writing:{input:state.input,word:state.card.word,meaning:state.card.meaning,idea:state.card.text}}:null;
 if(!state.card){result.replaceChildren();return;}
 const card=state.card,fruit=REWARD_POLICY.fruitPerSentence;
 result.innerHTML=`<article class="writing-seed"><div class="writing-seed-label"><span>${writingBook()}</span>Writing seed</div><p class="writing-caption">A word you could use</p><div class="writing-word"><span lang="zh-Hans">${voiceEscape(card.word)}</span><span>${voiceEscape(card.meaning)}</span></div><p class="writing-caption">Something to write about</p><p class="writing-prompt">${voiceEscape(card.text)}</p><button class="btn gray" id="writing-another">Try another idea</button><p class="reading-note">Use this as a starting point. Write your own sentence on paper.</p><div class="writing-finish"><button class="btn" id="writing-finish" ${state.claim.done?'disabled':''}>${state.claim.done?'Sentence celebrated':'I wrote my sentence'} · 🍊 +${fruit}</button><p class="reading-note">${state.claim.done?'Your reward is ready in Grove rewards.':`Finished? Celebrate your effort with ${fruit} orange${fruit===1?'':'s'}. No timer.`}</p></div></article>`;
 $('writing-another').onclick=generateWritingIdea;
 $('writing-finish').onclick=()=>{
  if(state.claim.done)return;
  const amount=completeWritingSentence(S,state.claim.id);
  state.claim.done=true;
  if(amount){save();announceRewards([{kind:'fruit',amount}]);}
  renderWritingIdea();
  $('writing-another').focus();
 };
 if(focused==='writing-another')$('writing-another').focus();
}
