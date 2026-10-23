// Release research only. A benchmark comparison cannot authorize audio promotion.
const fs=require('node:fs');
const COMPONENTS=['initial','final','tone'];
const SHA=/^[a-f0-9]{64}$/;
function phonemes(value){
 if(typeof value!=='string')return null;
 const match=/^([a-zü]+)([1-5])$/.exec(value.normalize('NFC').toLowerCase().replaceAll('v','ü'));
 if(!match)return null;
 const [,base,tone]=match;
 const y={yi:'i',ya:'ia',yao:'iao',ye:'ie',you:'iou',yan:'ian',yin:'in',yang:'iang',ying:'ing',yong:'iong',yu:'v',yue:'ve',yuan:'van',yun:'vn'};
 const w={wu:'u',wa:'ua',wo:'uo',wai:'uai',wei:'ui',wan:'uan',wen:'un',wang:'uang',weng:'ueng'};
 if(y[base]||w[base])return{initial:'',final:y[base]||w[base],tone};
 const initial=/^(zh|ch|sh|[bpmfdtnlgkhjqxrzcs])/.exec(base)?.[0]||'';
 let final=base.slice(initial.length).replaceAll('ü','v');
 if(['j','q','x'].includes(initial)&&final.startsWith('u'))final='v'+final.slice(1);
 if(final==='i'&&['z','c','s'].includes(initial))final='ii';
 if(final==='i'&&['zh','ch','sh','r'].includes(initial))final='iii';
 if(final==='iu')final='iou';
 if(!new Set(['a','o','e','ai','ei','ao','ou','an','en','ang','eng','ong','er','i','ia','ie','iao','iou','ian','in','iang','ing','iong','ii','iii','u','ua','uo','uai','ui','uan','un','uang','ueng','v','ve','van','vn']).has(final))return null;
 return{initial,final,tone};
}
function count(){return{total:0,matches:0,mismatch:0,uncertain:0,components:Object.fromEntries(COMPONENTS.map(c=>[c,{matches:0,mismatch:0,uncertain:0}]))}}
function status(actual,expected){
 const components=Object.fromEntries(COMPONENTS.map(k=>[k,actual?.[k]==null?'uncertain':actual[k]===expected[k]?'matches':'mismatch']));
 return{components,status:COMPONENTS.every(k=>components[k]==='matches')?'matches':COMPONENTS.some(k=>components[k]==='mismatch')?'mismatch':'uncertain'};
}
function add(counts,result){
 counts.total++;counts[result.status]++;
 for(const k of COMPONENTS)counts.components[k][result.components[k]]++;
}
function evaluate(clips,predictions,issues=[],criticalContrasts=[]){
 const positive=count(),splits={},results=[],controls={total:0,falseAccepted:0,rejected:0,uncertain:0,byComponent:Object.fromEntries([...COMPONENTS,'combined'].map(c=>[c,{total:0,falseAccepted:0,rejected:0,uncertain:0}]))};
 const readings=[...new Set(clips.map(c=>c.pinyin))].map(pinyin=>({pinyin,parts:phonemes(pinyin)}));
 for(const clip of clips){
  const expected=phonemes(clip.pinyin),actual=predictions.get(clip.id)||null,result=status(actual,expected);
  add(positive,result);add(splits[clip.split]??=count(),result);
  results.push({clipId:clip.id,pinyin:clip.pinyin,speaker:clip.speaker,split:clip.split,observed:actual,...result});
  // Same natural recording, another actually represented reading differing in one
  // component. No pitch resynthesis and no second model request with a leading answer.
  for(const other of readings){
   const changed=COMPONENTS.filter(k=>expected[k]!==other.parts[k]);
   if(changed.length!==1&&!criticalContrasts.some(pair=>pair.includes(clip.pinyin)&&pair.includes(other.pinyin)&&clip.pinyin!==other.pinyin))continue;
   const component=changed.length===1?changed[0]:'combined',wrong=status(actual,other.parts);
   const verdict=wrong.status==='matches'?'falseAccepted':changed.some(k=>actual?.[k]!=null&&actual[k]!==other.parts[k])?'rejected':'uncertain';
   for(const c of [controls,controls.byComponent[component]]){c.total++;c[verdict]++}
  }
 }
 return{positive,splits,controls,issues,results};
}
function summarize(manifest,capture){
 if(manifest.schemaVersion!==1||capture.schemaVersion!==1||!Array.isArray(manifest.clips)||!Array.isArray(capture.models)||!capture.models.length)throw Error('Invalid natural benchmark input');
 const ids=new Set(),speakers=new Map();
 for(const c of manifest.clips){
  if(!c.id||ids.has(c.id)||!SHA.test(c.sha256)||!phonemes(c.pinyin)||!c.speaker||!['development','held-out'].includes(c.split))throw Error('Invalid or duplicate reference');
  if(speakers.has(c.speaker)&&speakers.get(c.speaker)!==c.split)throw Error('A speaker cannot occur in both splits');
  speakers.set(c.speaker,c.split);ids.add(c.id);
 }
 const criticalContrasts=manifest.criticalContrasts||[];
 if(!Array.isArray(criticalContrasts)||criticalContrasts.some(pair=>!Array.isArray(pair)||pair.length!==2||pair[0]===pair[1]||pair.some(p=>!phonemes(p))))throw Error('Invalid critical contrasts');
 const maps=[],models=[],modelIds=new Set();
 for(const m of capture.models){
  if(!m.id||modelIds.has(m.id)||!SHA.test(m.weightsSha256)||m.input!=='audio-only'||!Array.isArray(m.predictions))throw Error('Expected unique, identified audio-only models');
  modelIds.add(m.id);const rows=new Map(),predictions=new Map(),issues=[];
  for(const p of m.predictions){if(rows.has(p.clipId))throw Error('Duplicate prediction');if(!ids.has(p.clipId))throw Error('Unknown prediction reference');rows.set(p.clipId,p)}
  for(const c of manifest.clips){
   const row=rows.get(c.id);
   if(!row||row.sha256!==c.sha256){issues.push({clipId:c.id,reason:row?'audio hash differs':'missing prediction'});predictions.set(c.id,null);continue}
   const p=row.components;
   if(p!=null&&COMPONENTS.some(k=>p[k]!=null&&typeof p[k]!=='string'))throw Error('Invalid predicted components');
   predictions.set(c.id,p||null);
  }
  maps.push(predictions);models.push({id:m.id,weightsSha256:m.weightsSha256,...evaluate(manifest.clips,predictions,issues,criticalContrasts)});
 }
 const agreed=new Map(manifest.clips.map(c=>[c.id,Object.fromEntries(COMPONENTS.map(k=>{
  const values=maps.map(m=>m.get(c.id)?.[k]);
  return[k,values[0]!=null&&values.every(v=>v===values[0])?values[0]:null];
 }))]));
 return{schemaVersion:1,manifestId:manifest.id,canPromote:false,
  note:'Measured agreement with published natural references. Source labels, benchmark accuracy and model consensus do not independently certify every recording or authorize release.',
  models,joint:{modelCount:models.length,...evaluate(manifest.clips,agreed,[],criticalContrasts)}};
}
module.exports={phonemes,summarize};
if(require.main===module){
 try{
  const [references,predictions,output]=process.argv.slice(2);
  if(!references||!predictions||!output)throw Error('Usage: node scripts/audio-natural-benchmark.cjs REFERENCES.json PREDICTIONS.json OUTPUT.json');
  const report=summarize(JSON.parse(fs.readFileSync(references)),JSON.parse(fs.readFileSync(predictions)));
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({report:output,canPromote:false,models:report.models.map(m=>({id:m.id,positive:m.positive,splits:m.splits,controls:m.controls})),joint:{positive:report.joint.positive,controls:report.joint.controls}},null,2));
 }catch(error){console.error(error.message);process.exitCode=1}
}
