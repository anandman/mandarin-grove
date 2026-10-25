/* Portable reading text, scope and evidence helpers. No network or storage access. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GroveReadings=api;})(globalThis,()=>{
 function split(text){return (String(text).match(/[^。！？.!?]+[。！？.!?]*/gu)||[]).map(s=>s.trim()).filter(Boolean);}
 function readingSentences(paragraphs,aids,annotations=[]){
  const rows=[];
  for(const [i,text]of paragraphs.entries()){
   const zh=split(text),py=split(aids.pinyin[i]),en=split(aids.translation[i]);
   if(!zh.length||zh.length!==py.length||zh.length!==en.length)throw Error('reading-sentence-alignment');
   for(let j=0;j<zh.length;j++){const n=rows.length;rows.push({text:zh[j],pinyin:py[j],english:en[j],words:annotations[n]||[]});}
  }
  return rows;
 }
 function readingTokens(text,index,words=[]){
  const chars=[...text],tokens=[];
  for(let i=0;i<chars.length;){
   if(!/\p{Script=Han}/u.test(chars[i])){tokens.push({text:chars[i++],lookup:false});continue;}
   const prepared=words.filter(w=>text.slice(chars.slice(0,i).join('').length).startsWith(w.word)).sort((a,b)=>b.word.length-a.word.length)[0];
   let word=prepared?.word;
   if(!word)for(let n=Math.min(16,chars.length-i);n>1;n--){const candidate=chars.slice(i,i+n).join('');if(/^\p{Script=Han}+$/u.test(candidate)&&index?.has(candidate)){word=candidate;break;}}
   word||=chars[i];tokens.push({text:word,lookup:true,...(prepared?{pinyin:prepared.pinyin,meaning:prepared.meaning}:{})});i+=[...word].length;
  }
  return tokens;
 }
 function readingScope({grade,chars=[],excluded=[],grades}){
  const order=['K','1','2','3','4','5'],level=order.indexOf(String(grade)),blocked=new Set(excluded),selected=[...new Set(chars)].filter(c=>/^\p{Script=Han}$/u.test(c)&&!blocked.has(c));
  const known=new Set([...order.slice(0,Math.max(0,level)).flatMap(g=>[...(grades[g]||'')]),...selected].filter(c=>!blocked.has(c)));
  return {grade:String(grade),level,selected,known,blocked};
 }
 function readingMatch(item,scope){
  const chars=[...new Set(item.characters||[])],targets=chars.filter(c=>scope.selected.includes(c)),unknown=chars.filter(c=>!scope.known.has(c));
  const eligible=scope.level>=0&&targets.length>0&&chars.length>0&&!chars.some(c=>scope.blocked.has(c))&&(!item.minGrade||scope.level>=item.minGrade)&&(scope.level>=4||!unknown.length);
  return {eligible,targets,unknown,rank:targets.length};
 }
 const copy=value=>JSON.parse(JSON.stringify(value)),object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 function newReadingSession(id,version,kind,count,now){return {id,version,kind,attempt:id+'-'+kind+'-'+now,created:now,phase:'reading',cursor:0,responses:{},pinyin:Array(count).fill(false),english:Array(count).fill(false),helpUsed:false,position:0};}
 function recordReadingAnswer(session,question,choice){
  if(session.responses[question.id])return copy(session);
  if(!question.options.some(o=>o.id===choice))throw Error('Unknown reading answer');
  const next=copy(session);next.responses[question.id]={choice,correct:choice===question.answer,assisted:!!session.helpUsed,method:'reading-choice'};return next;
 }
 function restoreReadingSession(raw,{id,version,kind,count},questions){
  if(!object(raw)||raw.id!==id||raw.version!==version||raw.kind!==kind||typeof raw.attempt!=='string'||!Number.isFinite(raw.created)||!['reading','questions','done'].includes(raw.phase)||!Number.isInteger(raw.cursor)||raw.cursor<0||raw.cursor>questions.length||typeof raw.helpUsed!=='boolean'||!Number.isInteger(raw.position)||raw.position<0||raw.position>=count||!object(raw.responses))return null;
  if(!['pinyin','english'].every(key=>Array.isArray(raw[key])&&raw[key].length===count&&raw[key].every(v=>typeof v==='boolean')))return null;
  for(const [key,r]of Object.entries(raw.responses)){
   const i=questions.findIndex(q=>q.id===key),q=questions[i];
   if(!q||i>raw.cursor||!object(r)||!q.options.some(o=>o.id===r.choice)||typeof r.correct!=='boolean'||r.correct!==(r.choice===q.answer)||typeof r.assisted!=='boolean'||r.method!=='reading-choice')return null;
  }
  if(questions.slice(0,raw.cursor).some(q=>!raw.responses[q.id])||(raw.phase==='done'&&raw.cursor!==questions.length))return null;
  if((raw.phase==='reading'&&(raw.cursor!==0||Object.keys(raw.responses).length))||(raw.phase==='questions'&&raw.cursor>=questions.length))return null;
  // Visible aids always imply help; malformed imports cannot turn help into unaided evidence.
  const next=copy(raw);if(next.pinyin.some(Boolean)||next.english.some(Boolean))next.helpUsed=true;
  return next;
 }
 function storeReadingSession(old,key,session,preservePrevious=false){
  let bank;
  if(object(old)&&old.version===1&&object(old.sessions)&&(old.history===undefined||Array.isArray(old.history)))bank=copy(old);
  else bank={version:1,sessions:{},history:[],...(old===undefined?{}:{preserved:[{value:copy(old)}]})};
  if(bank.preserved!==undefined&&!Array.isArray(bank.preserved))bank.preserved=[{value:bank.preserved}];
  if(preservePrevious&&Object.hasOwn(bank.sessions,key))(bank.preserved||=[]).push({key,value:copy(bank.sessions[key])});
  bank.sessions[key]={...(object(bank.sessions[key])&&!preservePrevious?bank.sessions[key]:{}),...copy(session)};
  if(session.phase==='done'&&!(bank.history||[]).some(r=>r?.attempt===session.attempt))(bank.history||=[]).push(copy(session));
  return bank;
 }
 return {readingSentences,readingTokens,readingScope,readingMatch,newReadingSession,recordReadingAnswer,restoreReadingSession,storeReadingSession};
});
