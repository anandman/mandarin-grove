// Explicit, bounded public text probes. Never part of the offline test command.
const {createLibrary}=require('../online-content.js'),catalog=require('../content/online-library.js');
async function probe(){
 const receipts=[],library=createLibrary(catalog,{cacheStorage:null});
 for(const item of library.list()){
  const start=Date.now();
  try{
   const result=await library.read(item.id),{readingAids,eligibleReadingText}=require('../online-content.js'),grades=require('../content/curriculum.json').grades;
   const characters=[...new Set((item.titleZh+result.paragraphs.join('')).match(/\p{Script=Han}/gu))].sort();
   if(JSON.stringify(characters)!==JSON.stringify(item.characters))throw Error('reading-character-inventory-mismatch');
   const aids=readingAids(item,result);
   receipts.push({id:item.id,ok:true,source:item.sourceId,url:library.sourceEndpoint(item.id),license:item.license,sha256:item.sha256,cacheableBytes:new TextEncoder().encode(result.raw).length,paragraphs:result.paragraphs.length,pinyin:aids.pinyin.length,translations:aids.translation.length,availableGrades:['K','1','2','3','4','5'].filter(g=>eligibleReadingText([item.titleZh,...result.paragraphs],g,grades)),milliseconds:Date.now()-start});
  }
  catch(error){receipts.push({id:item.id,ok:false,error:error.message,milliseconds:Date.now()-start});}
 }
 console.log(JSON.stringify({checkedAt:new Date().toISOString(),receipts},null,2));if(receipts.some(r=>!r.ok))process.exitCode=1;
}
if(require.main===module){if(!process.argv.includes('--live')){console.error('Pass --live to request the nine selected public text items. No child data or audio is sent.');process.exitCode=2;}else probe().catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={probe};
