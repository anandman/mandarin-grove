// Release-time diagnostics only. Importing this module reads no credentials and makes no requests.
// Contract: https://api.toneperfect.app/docs and /pinyin-pronunciation-api/ (checked 2026-10-22).
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {numberedPinyin}=require('./audio-pilot.cjs');
const ENDPOINT='https://api.toneperfect.app/v1/assess';
const PROTOCOL='toneperfect-full-response-v2-2026-10-22';
const DIMENSIONS=['initial','final','tone'];
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

function normalizePinyin(value){
 if(typeof value!=='string'||!value.trim())throw Error('A nonempty pinyin reference is required');
 const text=value.trim().toLowerCase().normalize('NFC');
 const numbered=text.split(/\s+/).every(s=>/^[a-züv]+[0-5]$/.test(s));
 const result=numbered?text.split(/\s+/).join(' '):numberedPinyin(text);
 return result.replace(/v/g,'ü').replace(/0(?= |$)/g,'5');
}
// Independent spelling rules, not values copied from the assessor's reference echo.
// Hanyu Pinyin spelling: y/w, j/q/x+ü, and iou/uei/uen contractions.
// https://www.polyu.edu.hk/bepth/introduction-to-phonetics/spelling-rules-in-pinyin/
const INITIALS=new Set(['','b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w']);
const FINALS=new Set('a o e ai ei ao ou an en ang eng ong er i ia ie iao iou ian in iang ing iong u ua uo uai uei uan uen uang ueng ü üe üan ün'.split(' '));
const Y_FINALS={i:'i',a:'ia',e:'ie',ao:'iao',ou:'iou',an:'ian',in:'in',ang:'iang',ing:'ing',ong:'iong',u:'ü',ue:'üe',uan:'üan',un:'ün'};
const W_FINALS={u:'u',a:'ua',o:'uo',ai:'uai',ei:'uei',an:'uan',en:'uen',ang:'uang',eng:'ueng'};
const sound=value=>typeof value==='string'?value.normalize('NFC').toLowerCase().replace(/v/g,'ü'):null;
function canonicalPair(initial,final){
 initial=sound(initial);final=sound(final);
 if(!INITIALS.has(initial)||!final)return null;
 if(initial==='y'){
  final=Y_FINALS[final]||(['i','ia','ie','iao','iou','ian','in','iang','ing','iong','ü','üe','üan','ün'].includes(final)?final:null);initial='';
 }else if(initial==='w'){
  final=W_FINALS[final]||(['u','ua','uo','uai','uei','uan','uen','uang','ueng'].includes(final)?final:null);initial='';
 }
 if(!final)return null;
 if(['zh','ch','sh','r'].includes(initial)&&['i','iii'].includes(final))return{initial,final:'apical-retroflex'};
 if(['z','c','s'].includes(initial)&&['i','ii'].includes(final))return{initial,final:'apical-dental'};
 if(['ii','iii'].includes(final))return null;
 if(['j','q','x'].includes(initial)&&/^u(?:e|an|n)?$/.test(final))final='ü'+final.slice(1);
 final=({iu:'iou',ui:'uei',un:'uen'})[final]||final;
 if(!FINALS.has(final))return null;
 // Reject impossible combinations rather than interpreting arbitrary labels as Pinyin.
 if(['j','q','x'].includes(initial)&&!['i','ia','ie','iao','iou','ian','in','iang','ing','iong','ü','üe','üan','ün'].includes(final))return null;
 if(['g','k','h','zh','ch','sh','r','z','c','s'].includes(initial)&&/^[iü]/.test(final))return null;
 return{initial,final};
}
function canonicalSyllable(syllable){
 const base=syllable.slice(0,-1),match=/^(zh|ch|sh|[bpmfdtnlgkhjqxrzcswy])/.exec(base),initial=match?match[0]:'';
 const pair=canonicalPair(initial,base.slice(initial.length));
 return pair?{...pair,spellingInitial:initial}:null;
}
function canonicalInitial(value,target){
 const initial=sound(value);if(!INITIALS.has(initial))return null;
 return target?.initial===''&&['y','w'].includes(target.spellingInitial)&&['',target.spellingInitial].includes(initial)?'':initial;
}
function combine(statuses){
 const measured=statuses.filter(s=>s!=='not-applicable');
 return !measured.length?(statuses.length?'not-applicable':'uncertain'):measured.includes('uncertain')?'uncertain':measured.includes('mismatch')?'mismatch':measured.every(s=>s==='matches')?'matches':'uncertain';
}
function classifyAssessment(response,{pinyin,kind,diagnosticMinScore=90}={}){
 if(typeof diagnosticMinScore!=='number'||!Number.isFinite(diagnosticMinScore)||diagnosticMinScore<0||diagnosticMinScore>100)throw Error('Invalid diagnostic score threshold');
 const reference=normalizePinyin(pinyin).split(' ');
 const output={status:'uncertain',components:{initial:'uncertain',final:'uncertain',tone:'uncertain'},syllables:[],reasons:[],calibrated:false,diagnosticMinScore,policy:'Diagnostic threshold only; no pronunciation certification or release approval.'};
 if(!response||typeof response!=='object'||response.test===true||response.test==='true'){output.reasons.push('Missing response or fixture/test response');return output;}
 if(response.assessable!==true||response.status!=='completed'){output.reasons.push('Provider did not complete an assessable result');return output;}
 if(typeof response.model_version!=='string'||!response.model_version){output.reasons.push('Missing provider model version');return output;}
 if(!Array.isArray(response.syllables)||response.syllables.length!==reference.length){output.reasons.push('Missing or incomplete acoustic syllable alignment');return output;}
 // A reference echo is not acoustic evidence: use component heard labels and confidence as well.
 const connected=kind!=='character'||reference.length!==1;
 for(let index=0;index<reference.length;index++){
  const row=response.syllables[index],entry={index,pinyin:reference[index],components:{},reasons:[]};
  let expectedPinyin;
  try{expectedPinyin=normalizePinyin(row?.expected?.pinyin);}catch{}
  const target=canonicalSyllable(reference[index]),onset=row?.components?.initial;
  // Observed zero-onset schema omits expected/heard on an inapplicable initial.
  // Absence is legitimate only when the independent Pinyin parse also has no onset.
  const unmeasuredOnset=target?.initial===''&&row?.expected?.initial===null&&onset?.applicable===false&&onset.expected==null&&onset.heard==null&&onset.score==null&&onset.confidence==null&&onset.decision==='unassessable';
  const providerInitial=unmeasuredOnset?'':row?.expected?.initial,providerPair=canonicalPair(providerInitial,row?.expected?.final);
  const decompositionOK=target&&providerPair&&target.initial===providerPair.initial&&target.final===providerPair.final;
  const alignmentOK=decompositionOK&&expectedPinyin===reference[index]&&row?.index===index&&Array.isArray(row.span_ms)&&row.span_ms.length===2&&row.span_ms.every(Number.isFinite)&&row.span_ms[0]>=0&&row.span_ms[1]>row.span_ms[0];
  if(!alignmentOK)entry.reasons.push('Expected pinyin or syllable alignment contradicts the supplied reference');
  for(const dimension of DIMENSIONS){
   const evidence=row?.components?.[dimension],expected=row?.expected?.[dimension];
   const unit={status:'uncertain',applicable:evidence?.applicable??null,expected:evidence?.expected??null,heard:evidence?.heard??null,score:evidence?.score??null,confidence:evidence?.confidence??null,decision:evidence?.decision??null,reasons:[]};
   if(dimension==='initial'&&unmeasuredOnset&&alignmentOK){unit.status='not-applicable';unit.reasons.push('This Pinyin syllable has no initial consonant; no initial was measured');entry.components[dimension]=unit;continue;}
   const label=value=>dimension==='tone'?String(value):dimension==='initial'?canonicalInitial(value,target):canonicalPair(providerInitial,value)?.final??null;
   const expectedLabel=label(expected),referenceTone=reference[index].slice(-1);
   const labelsValid=dimension==='tone'?/^[1-5]$/.test(expectedLabel||'')&&expectedLabel===referenceTone&&/^[1-5]$/.test(label(evidence?.heard)||''):expectedLabel!==null&&label(evidence?.heard)!==null;
   const scoreOK=typeof evidence?.score==='number'&&Number.isFinite(evidence.score)&&evidence.score>=0&&evidence.score<=100;
   if(!alignmentOK||!evidence||!labelsValid||label(evidence.expected)!==expectedLabel){unit.reasons.push('Missing or contradictory expected/heard component evidence');}
   else if(dimension==='tone'&&(referenceTone==='5'||label(evidence.heard)==='5')){unit.reasons.push('Neutral tone is not reliably distinguished by this provider');}
   else if(evidence.confidence!=='high'||!scoreOK||!['review','uncertain','no_correction'].includes(evidence.decision)){unit.reasons.push('Confidence, score, or decision is missing or unsupported');}
   else if(typeof evidence.agrees_with_prompt==='boolean'&&evidence.agrees_with_prompt!==(label(evidence.heard)===expectedLabel)){unit.reasons.push('Provider agreement flag contradicts the acoustic labels');}
   else if(evidence.decision==='uncertain'){unit.reasons.push('Provider marked the component uncertain');}
   else if(label(evidence.heard)!==expectedLabel){
    if(connected&&dimension==='tone')unit.reasons.push('Connected-speech tone mismatch may involve sandhi or coarticulation');
    else{unit.status='mismatch';unit.reasons.push('High-confidence heard component differs from the supplied reference');}
   }else if(evidence.decision==='review'){unit.status='mismatch';unit.reasons.push('Provider flagged high-confidence component evidence for correction');}
   else if(evidence.score<diagnosticMinScore){unit.reasons.push('Below the configured, uncalibrated diagnostic threshold');}
   else unit.status='matches';
   entry.components[dimension]=unit;
  }
  output.syllables.push(entry);
 }
 for(const dimension of DIMENSIONS)output.components[dimension]=combine(output.syllables.map(s=>s.components[dimension].status));
 output.status=combine(Object.values(output.components));
 if(connected&&output.status==='matches'){output.status='uncertain';output.reasons.push('Connected speech needs context-sensitive calibration; component matches alone do not settle it');}
 return output;
}

function atomicJSON(file,value){fs.writeFileSync(file+'.tmp',JSON.stringify(value,null,2)+'\n',{mode:0o600});fs.renameSync(file+'.tmp',file);}
function readAudio(clip){
 if(typeof clip.file!=='string'||!path.isAbsolute(clip.file))throw Error('Assessment requires an absolute audio file path');
 const size=fs.statSync(clip.file).size;if(size<1||size>10*1024*1024)throw Error('Audio file must be nonempty and at most 10 MB');
 const bytes=fs.readFileSync(clip.file),sha256=digest(bytes);
 if(clip.sha256!==undefined&&(!/^[a-f0-9]{64}$/.test(clip.sha256)||clip.sha256!==sha256))throw Error('Audio changed or expected digest is invalid: '+clip.id);
 return {bytes,sha256};
}
function isTestResponse(response){return response?.test===true||response?.test==='true';}
function readCache(file,item,transport){
 const saved=JSON.parse(fs.readFileSync(file,'utf8'));
 if(saved.cacheKey!==item.cacheKey||JSON.stringify(saved.identity)!==JSON.stringify(item.identity)||saved.provenance?.transport!==transport||saved.provenance?.endpoint!==ENDPOINT||saved.provenance?.protocol!==PROTOCOL||saved.provenance?.realProviderCall!==(transport==='native-fetch')||saved.responseHash!==digest(JSON.stringify(saved.response))||isTestResponse(saved.response))throw Error('Assessment cache has inconsistent provenance or a test response');
 return saved;
}
async function assessClips(clips,folder,options={}){
 const {apiKey,maxRequests,diagnosticMinScore=90,timeoutMs=95000}=options;
 if(!Number.isSafeInteger(maxRequests)||maxRequests<1)throw Error('Set an explicit positive integer assessment request budget (maxRequests)');
 if(typeof apiKey!=='string'||!apiKey.trim())throw Error('Set TONEPERFECT_API_KEY locally; never put it in the app');
 if(apiKey.startsWith('tp_test_'))throw Error('A test key returns fixed fixtures and cannot assess audio');
 if(!apiKey.startsWith('tp_live_')||/\s/.test(apiKey))throw Error('A documented TonePerfect live API key is required');
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>120000)throw Error('Assessment timeout must be positive and at most 120000 ms');
 if(!Number.isFinite(diagnosticMinScore)||diagnosticMinScore<0||diagnosticMinScore>100)throw Error('Invalid diagnostic score threshold');
 if(!Array.isArray(clips)||!clips.length)throw Error('A nonempty clip array is required');
 if(typeof folder!=='string'||!path.isAbsolute(folder))throw Error('Assessment cache folder must be an absolute path');
 const fetchImpl=options.fetchImpl||globalThis.fetch,transport=options.fetchImpl?'injected-fetch':'native-fetch';
 if(typeof fetchImpl!=='function')throw Error('A fetch implementation is required');
 const ids=new Set();
 // Preflight the whole run, including hashes and uncached request count, before any network.
 const prepared=clips.map(clip=>{
  if(!clip||typeof clip.id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(clip.id)||ids.has(clip.id))throw Error('Invalid or duplicate clip ID');ids.add(clip.id);
  const pinyin=normalizePinyin(clip.pinyin),characters=[...(clip.text||'')].filter(ch=>/\p{Script=Han}/u.test(ch));
  if(typeof clip.text!=='string'||!clip.text.trim()||!/^[-\p{Script=Han}\p{P}\p{Z}\s]+$/u.test(clip.text)||characters.length!==pinyin.split(' ').length||characters.length>100||!['character','sentence'].includes(clip.kind))throw Error('Invalid characters, pinyin count, or clip kind: '+clip.id);
  const extension=path.extname(clip.file||'').toLowerCase(),types={'.wav':'audio/wav','.mp3':'audio/mpeg','.m4a':'audio/mp4','.ogg':'audio/ogg','.webm':'audio/webm'};
  if(!types[extension])throw Error('Unsupported assessment audio extension');
  const {sha256}=readAudio(clip),task=clip.kind==='character'?'isolated_word':'connected_speech';
  // Keep candidates and their counterfactuals on the same documented inference path.
  // Pinyin-only and characters+pinyin can select different provider model families;
  // the returned model version is evidence, not a claim that either family is better.
  const referenceMode=clip.kind==='character'?'pinyin-only':'characters-and-pinyin';
  const identity={protocol:PROTOCOL,endpoint:ENDPOINT,sha256,text:clip.text,pinyin,task,language:'zh-CN',referenceMode};
  const cacheKey=digest(JSON.stringify(identity));
  const cacheFile=path.join(folder,'toneperfect-'+cacheKey+'-'+transport+'.json');let saved;
  if(fs.existsSync(cacheFile)){
   saved=readCache(cacheFile,{cacheKey,identity},transport);
  }
  return {clip,pinyin,sha256,task,cacheKey,cacheFile,identity,saved,type:types[extension]};
 });
 const pending=new Set(prepared.filter(p=>!p.saved).map(p=>p.cacheKey)).size;
 if(pending>maxRequests)throw Error('Assessment exceeds the explicit request budget: '+pending+' requests needed');
 fs.mkdirSync(folder,{recursive:true});
 const report={schemaVersion:1,provider:'TonePerfect',protocol:PROTOCOL,requests:0,results:[]};
 const checkpoint=()=>atomicJSON(path.join(folder,'assessment-checkpoint.json'),report);
 for(const item of prepared){
  // Reread on every clip, including cache hits; never trust a stale declared SHA.
  const snapshot=readAudio(item.clip);if(snapshot.sha256!==item.sha256)throw Error('Audio changed after assessment preflight: '+item.clip.id);
  let record=item.saved,cached=!!record;
  // Identical references/audio in this batch share the same response.
  if(!record&&fs.existsSync(item.cacheFile)){record=readCache(item.cacheFile,item,transport);cached=true;}
  if(!record){
   if(report.requests>=maxRequests)throw Error('Assessment request budget exhausted');
   const form=new FormData();form.append('audio',new Blob([snapshot.bytes],{type:item.type}),path.basename(item.clip.file));if(item.identity.referenceMode!=='pinyin-only')form.append('text',item.clip.text);form.append('pinyin',item.pinyin);form.append('language','zh-CN');form.append('task',item.task);
   const controller=new AbortController();let timer;
   report.requests++;
   try{
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Assessment timeout'));},timeoutMs);});
    const request=(async()=>{
     const result=await fetchImpl(ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Idempotency-Key':'grove-'+item.cacheKey},body:form,signal:controller.signal});
     if(!result.ok)throw Error('Assessment failed (HTTP '+result.status+')');
     const response=await result.json();
     if(result.headers?.get('X-TonePerfect-Test')==='true'||isTestResponse(response))throw Error('Provider returned a test fixture; no acoustic assessment occurred');
     if(!response||typeof response!=='object'||Array.isArray(response))throw Error('Assessment returned invalid JSON');
     return response;
    })();
    const response=await Promise.race([request,timeout]);
    record={schemaVersion:1,cacheKey:item.cacheKey,identity:item.identity,response,responseHash:digest(JSON.stringify(response)),provenance:{provider:'TonePerfect',endpoint:ENDPOINT,protocol:PROTOCOL,referenceMode:item.identity.referenceMode,transport,realProviderCall:transport==='native-fetch',retrievedAt:new Date().toISOString(),modelVersion:typeof response.model_version==='string'?response.model_version:null,idempotencyKey:'grove-'+item.cacheKey}};
    atomicJSON(item.cacheFile,record);
   }catch(error){
    // Never propagate a transport exception that may contain a key or request body.
    const safe=/^(Assessment timeout|Assessment failed \(HTTP \d+\)|Provider returned a test fixture; no acoustic assessment occurred|Assessment returned invalid JSON)$/.test(error.message)?error.message:'Assessment request failed; provider response and credentials omitted';
    throw Error(safe);
   }finally{clearTimeout(timer);}
  }
  if(readAudio(item.clip).sha256!==item.sha256)throw Error('Audio changed during assessment: '+item.clip.id);
  report.results.push({clipId:item.clip.id,file:item.clip.file,sha256:item.sha256,cacheKey:item.cacheKey,cached,provenance:record.provenance,response:record.response,assessment:classifyAssessment(record.response,{pinyin:item.pinyin,kind:item.clip.kind,diagnosticMinScore})});checkpoint();
 }
 return report;
}
module.exports={assessClips,classifyAssessment,ENDPOINT,PROTOCOL};
