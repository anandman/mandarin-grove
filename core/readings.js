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
 return {readingSentences,readingTokens};
});
