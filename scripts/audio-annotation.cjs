// Research metadata formatting only, never pronunciation approval.
// Pinyin Scheme spelling notes4–5:
// https://yywz.ecnu.edu.cn/1f/56/c30556a335702/page.htm
// https://jwc.hnfnu.edu.cn/info/1055/3129.htm
const {phonemes}=require('./audio-natural-benchmark.cjs');
function annotationPinyin(value){
 if(typeof value!=='string'||value.length>100)return null;
 const label=value.normalize('NFC').toLowerCase().replace(/[\s|]/g,'');
 // Only whole ordinary-u finals in licensed consonant contexts. Do not erase
 // explicit ü or invent j/q/x/y expanded spellings, tones or missing segments.
 const consonant=/^(zh|ch|sh|[bpmfdtnlgkhrzcs])(uei|uen)([1-5])$/.exec(label);
 if(consonant)return consonant[1]+(consonant[2]==='uei'?'ui':'un')+consonant[3];
 const zero=/^(uei|uen)([1-5])$/.exec(label);
 if(zero)return(zero[1]==='uei'?'wei':'wen')+zero[2];
 return label;
}
function annotationComponents(value){return phonemes(annotationPinyin(value))}
module.exports={annotationPinyin,annotationComponents};
