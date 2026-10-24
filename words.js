// Local 组词 practice. Dictionary recognition is separate from assessed character mastery.
function createWordIndex(bank){
 const index=new Map();index.characterForms=bank.aliases||{};
 for(const row of bank.entries){for(const form of [row[0],row[1]].filter(Boolean)){if(!index.has(form))index.set(form,[]);index.get(form).push(row);}}
 return index;
}
function checkWordAnswer(character,value,index,collected=[]){
 const input=value.trim();
 if(!/^\p{Script=Han}{2,8}$/u.test(input))return {status:'input-help',input};
 const entries=(index.get(input)||[]).filter(row=>row[0].includes(character));
 if(!entries.length)return {status:[character,...(index.characterForms[character]||[])].some(form=>input.includes(form))?'unverified':'missing-target',input};
 const word=entries[0][0];
 return {status:collected.includes(word)?'duplicate':'recognized',input,word,entries};
}
function collectWord(state,character,result){
 if(result.status!=='recognized')return false;
 const known=state.wordPractice?.words?.[character]||[];if(known.includes(result.word))return false;
 state.wordPractice??={version:1,words:{}};state.wordPractice.words??={};state.wordPractice.words[character]=[...known,result.word];return true;
}
function pinyinWithMarks(value){
 return value.replace(/([a-zü:]+)([1-5])/gi,(_,raw,digit)=>{
  const base=raw.replace(/u:/gi,'ü').replace(/v/gi,'ü'),tone=Number(digit);if(tone===5)return base;
  const lower=base.toLowerCase();let position=lower.indexOf('a');if(position<0)position=lower.indexOf('e');if(position<0&&lower.includes('ou'))position=lower.indexOf('o');if(position<0)for(let i=lower.length-1;i>=0;i--)if('aeiouü'.includes(lower[i])){position=i;break;}
  if(position<0)return base;
  const mark=['\u0304','\u0301','\u030c','\u0300'][tone-1];return (base.slice(0,position+1)+mark+base.slice(position+1)).normalize('NFC');
 });
}
let WORD_BANK_PROMISE=null,WORD_SESSION=null;
function loadWordBank(){
 if(!WORD_BANK_PROMISE)WORD_BANK_PROMISE=fetch('vendor/cc-cedict/words.json?v=1').then(response=>{if(!response.ok)throw Error('Word bank unavailable');return response.json();}).then(createWordIndex).catch(error=>{WORD_BANK_PROMISE=null;throw error;});
 return WORD_BANK_PROMISE;
}
function wordPracticeEntry(){return `<button class="grove-explore-card grove-word-entry" onclick="showWordPractice()"><span class="grove-explore-icon" aria-hidden="true">${groveTree('writing')}</span><b>Build words</b><small>组词 · 2–8 characters</small></button>`;}
function wordStudyQuestion(card){showWordPractice([card],'',true);}
function showWordPractice(cards=CARDS,source='Your practice characters',inStudy=false){
 const study=inStudy&&!!SESS?.study;screen();if(!study){SESS=null;CRAM=null;}
 const pool=[...new Map(cards.map(c=>[c.c,c])).values()];
 if(!pool.length){A.innerHTML='<h1>Build words</h1><p>Choose some characters to get started.</p><button class="btn" onclick="showCram()">Choose units</button>';return;}
 const owner=PR.cur,session={owner,pool:shuffle(pool.slice()),index:null,result:null,source,study};WORD_SESSION=session;if(study)beginReview(pool[0],'words');
 A.innerHTML=`<section class="word-practice" id="word-practice" aria-labelledby="word-title"><div class="writing-heading"><span class="writing-tree">${groveTree('writing')}</span><div><h1 id="word-title">Build words <span lang="zh-Hans">组词</span></h1><p>Use one character to build longer words.</p></div></div>
 ${study?studySessionBar():''}<p class="word-instructions" id="word-pace">${study?'One answer per question. Use this character in a longer word or short expression.':'Add as many different answers as you like. Choose <b>Next character</b> whenever you’re ready.'}</p>
 ${study?'':`<div class="word-tools"><label>Character <select id="word-character" aria-label="Practice character">${session.pool.map(c=>`<option value="${esc(c.c)}">${esc(c.c)}</option>`).join('')}</select></label><button class="btn gray" id="word-next">Next character ↗</button><button class="progress-link" onclick="showCram(true)" aria-label="Choose other units">Units</button></div><p class="reading-note">${esc(source)} · ${pool.length} character${pool.length===1?'':'s'}</p>`}
 <article class="word-seed"><div class="word-target" id="word-target" lang="zh-Hans"></div><label for="word-input" id="word-label"></label><p class="reading-note word-input-help" id="word-input-help">Use <b>2–8 Chinese characters</b> per answer, without spaces or punctuation.</p><form id="word-form"><input id="word-input" type="text" lang="zh-Hans" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Your answer" aria-describedby="word-input-help word-pace word-status"><button class="btn" id="word-check" disabled>Check answer</button></form>${study?'<button class="progress-link" id="word-dont-know">I don’t know a word yet</button>':''}<p id="word-status" role="status">Loading the local word bank…</p><div id="word-result" aria-live="polite"></div><button class="progress-link" id="word-retry" hidden>Try loading again</button>${study?'<button class="btn" id="word-study-next" hidden>Next question ↗</button>':''}</article>
 <section class="word-collection" ${study?'hidden':''}><h2 id="word-count"></h2><div id="word-collected"></div></section>
 <details class="compact-help"><summary>How to build words</summary><p>A single character can be a word, too. In this activity, use the displayed character in a longer word or short expression with 2–8 Chinese characters. ${study?'':'For 学, try 学校 or 学生.'} ${study?'Give one answer, then choose Next question. Previously collected words are welcome in a new round.':'There is no required number of answers per character: add as many different answers as you like, then choose Next character when you’re ready.'} A dictionary match checks a listed word, rather than judging a whole sentence. Answers outside the word bank are not checked and never count as mistakes. Word collections save on this device with your backup. ${study?'Checked answers count toward the round and track word-building practice separately. Words are not required for character mastery.':'This standalone collection keeps character mastery and orange rewards unchanged.'}</p><p>Dictionary: CC-CEDICT · MDBG and contributors · <a href="vendor/cc-cedict/LICENSE" target="_blank" rel="noopener">CC BY-SA 4.0</a>. The word bank is a dictionary, not a teacher-reviewed curriculum.</p></details>${study?'':'<button class="progress-link" onclick="home()">Back to your grove</button>'}</section>`;
 const root=$('word-practice'),input=$('word-input');let composing=false;
 const current=()=>study?pool[0]:session.pool.find(c=>c.c===$('word-character').value);
 function renderCharacter(){const card=current();session.result=null;input.value='';$('word-target').textContent=card.c;$('word-label').textContent='Build a longer word with '+card.c+'.';$('word-result').replaceChildren();$('word-status').textContent=session.index?'Ready for your word.':'Loading the local word bank…';renderWordCollection(card.c);feedbackQuestion={c:card.c,p:card.p,m:card.m,mode:'word-practice'};}
 function submit(event){event.preventDefault();if(composing||!session.index||(study&&session.finished))return;const card=current(),result=checkWordAnswer(card.c,input.value,session.index,S.wordPractice?.words?.[card.c]||[]);session.result=result;
  const messages={'input-help':/^\p{Script=Han}$/u.test(result.input)?'A single character can be a word. Here, use 2–8 characters and include '+card.c+'.':'Use 2–8 Chinese characters, without spaces or punctuation.','missing-target':'Use '+card.c+' somewhere in your answer.','unverified':'Not in our word bank yet.','duplicate':'You already collected this word. Add a different answer, or choose Next character.','recognized':'A word for your collection! Add another, or choose Next character.'};
  $('word-status').textContent=study&&['recognized','duplicate'].includes(result.status)?'Word found! Choose Next question.':messages[result.status];$('word-result').replaceChildren();
  for(const entry of (result.entries||[]).slice(0,3)){const p=document.createElement('p');p.className='word-definition';const strong=document.createElement('strong');strong.lang='zh-Hans';strong.textContent=entry[0];const pronunciation=document.createElement('span');pronunciation.lang='zh-Latn-pinyin';pronunciation.textContent=pinyinWithMarks(entry[2]);const meaning=document.createElement('small');meaning.textContent=entry[3];p.append(strong,pronunciation,meaning);$('word-result').append(p);}
  if(collectWord(S,card.c,result)){save();renderWordCollection(card.c);if(!study)input.select();}
  if(study){
   if(result.status==='missing-target'){studyAttempt('miss');ACTIVE_REVIEW.missed=true;}
   const accepted=['recognized','duplicate'].includes(result.status);
   if(accepted){finishReview('correct');lockWordAnswer();}
   $('word-study-next').hidden=!accepted&&result.status!=='unverified';
  }
 }
 input.addEventListener('compositionstart',()=>{composing=true;});input.addEventListener('compositionend',()=>{composing=false;});input.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.isComposing||composing||event.keyCode===229))event.preventDefault();});$('word-form').onsubmit=event=>{event.preventDefault();ActivityUI.run(()=>submit(event));};
 function lockWordAnswer(){session.finished=true;root.querySelector('.word-collection').hidden=false;input.disabled=true;$('word-check').disabled=true;$('word-dont-know').hidden=true;}
 if(study){$('word-dont-know').onclick=()=>ActivityUI.run(()=>{if(session.finished)return;session.result={status:'miss'};finishReview('miss');lockWordAnswer();$('word-status').textContent='Saved for more practice. Choose Next question.';$('word-result').replaceChildren();$('word-study-next').hidden=false;});
 $('word-study-next').onclick=()=>ActivityUI.run(()=>{if(!session.result)return;if(session.result.status==='unverified'){if(studyAttemptInfo()?.miss)finishReview('miss');else recordStudyAnswer(null,'unverified');ACTIVE_REVIEW=null;}nextItem();});}
 else{$('word-character').onchange=renderCharacter;
 $('word-next').onclick=()=>{const at=session.pool.findIndex(c=>c.c===$('word-character').value);$('word-character').value=session.pool[(at+1)%session.pool.length].c;renderCharacter();input.focus();};}
 async function load(){ $('word-retry').hidden=true;try{const index=await loadWordBank();if($('word-practice')!==root||PR.cur!==owner)return;session.index=index;if(study&&session.finished)return;$('word-check').disabled=false;$('word-status').textContent='Ready for your word.';}catch{if($('word-practice')!==root||PR.cur!==owner||(study&&session.finished))return;$('word-status').textContent='Could not load the word bank. Check your connection and try again.';$('word-retry').hidden=false;}}
 $('word-retry').onclick=load;renderCharacter();load();
}
function renderWordCollection(character){
 const words=S.wordPractice?.words?.[character]||[];$('word-count').textContent=words.length+' word'+(words.length===1?'':'s')+' collected for '+character;
 const list=$('word-collected');list.replaceChildren();
 for(const word of words){const chip=document.createElement('span');chip.className='word-leaf';chip.lang='zh-Hans';chip.textContent=word;list.append(chip);}
 if(!words.length){const text=document.createElement('p');text.className='reading-note';text.textContent='Your words will grow here.';list.append(text);}
}
if(typeof module!=='undefined')module.exports={createWordIndex,checkWordAnswer,collectWord,pinyinWithMarks};
