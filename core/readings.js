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
 return {readingSentences,readingTokens,readingScope,readingMatch};
});
