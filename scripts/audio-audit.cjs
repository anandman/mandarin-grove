// Release-time diagnostics only. No services, secrets or child state are used on import.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {numberedPinyin}=require('./audio-pilot.cjs');
const {classifyAssessment,ENDPOINT,PROTOCOL}=require('./audio-assessment.cjs');
const {spawnSync}=require('node:child_process');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const DEFAULT_CHARACTERS=['止','离','满','狗','口','买','卖','女','绿','假','祖','组'];
function reading(value){
 const normalized=value.trim().toLowerCase().normalize('NFC');
 return /^[a-zü]+[1-5]$/.test(normalized)?normalized:numberedPinyin(normalized);
}
function availability(file,expected){
 try{const sha256=hash(fs.readFileSync(file));return{sha256,availability:expected&&expected!==sha256?'changed':'available'}}
 catch(error){if(error.code==='ENOENT')return{sha256:null,availability:'missing'};throw error}
}
function addControls(candidate){
 const match=/^([a-zü]+)([1-4])$/.exec(candidate.pinyin);if(!match)return[];
 const [,base,tone]=match,contrasts=[{component:'tone',pinyin:base+(Number(tone)%4+1)}];
 const initials={g:'k',k:'g',b:'p',p:'b',d:'t',t:'d',zh:'z',z:'zh',ch:'c',c:'ch',sh:'s',s:'sh',n:'l',l:'n'};
 const initial=/^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])/.exec(base)?.[0];
 if(initials[initial])contrasts.push({component:'initial',pinyin:initials[initial]+base.slice(initial.length)+tone});
 if(/^[nl]ü/.test(base))contrasts.push({component:'final',pinyin:base.replace('ü','u')+tone});
 return contrasts.map(c=>({...candidate,id:hash(JSON.stringify({source:candidate.id,...c})).slice(0,24),pinyin:c.pinyin,role:'control',control:{sourceId:candidate.id,component:c.component},note:'Deliberately contradictory reference for the same bytes; tests the assessor, not a new recording.'}));
}
function finish(clips,source){
 return{schemaVersion:1,id:hash(JSON.stringify({source,clips})).slice(0,24),source,createdAt:new Date().toISOString(),canPromote:false,
  limitations:['Diagnostic model agreement is not independent proof of correct Mandarin.','Controls must reject the altered component, not merely another sound.','No app audio is replaced by this manifest or its assessment.'],clips};
}
function candidate(entry,file,expected){
 const state=availability(file,expected),pinyin=reading(entry.pinyin);
 return{id:hash(JSON.stringify({caseId:entry.id,text:entry.text,pinyin,sha256:expected||state.sha256,file})).slice(0,24),caseId:entry.id,text:entry.text,pinyin,kind:entry.kind,file,expectedSha256:expected||state.sha256,...state,role:'candidate'};
}
function createBundledAudit(dataset,{audioDir=path.join(__dirname,'../audio'),characters=DEFAULT_CHARACTERS,controls=true}={}){
 if(!Array.isArray(characters)||!characters.length)throw Error('Choose a nonempty character list');
 const entries=dataset.cases.filter(c=>c.kind==='character'&&characters.includes(c.text));
 if(!entries.length)throw Error('No selected characters in this evaluation set');
 const clips=[];for(const entry of entries){
  if([...entry.text].length!==1||!/^\p{Script=Han}$/u.test(entry.text))throw Error('Invalid character filename');
  const c=candidate(entry,path.resolve(audioDir,entry.text+'.mp3'));clips.push(c);if(controls)clips.push(...addControls(c));
 }
 return finish(clips,{kind:'bundled',datasetVersion:dataset.version,referenceStatus:'catalog-expected, not independently verified',audioProvenance:'Recovered Google Cloud TTS recordings; exact voice/settings unavailable'});
}
function createGeneratedAudit(plan,{audioDir,controls=true}={}){
 const clips=[];for(const entry of plan.clips){
  if(typeof entry.file!=='string'||path.basename(entry.file)!==entry.file||/[\\/]/.test(entry.file)||!entry.file.endsWith('.mp3'))throw Error('Invalid generated audio file');
  const c=candidate(entry,path.resolve(audioDir,entry.file),entry.sha256);if(!entry.sha256)c.availability='untracked';
  clips.push(c);if(controls&&c.kind==='character')clips.push(...addControls(c));
 }
 return finish(clips,{kind:'generated',planId:plan.id,referenceStatus:'explicit synthesis target, not independently verified'});
}
function withToneControls(manifest,controlManifest){
 const controls=controlManifest.clips;
 if(controlManifest.schemaVersion!==1||controlManifest.method!=='praat-pitch-tier-overlap-add-v1'||!Array.isArray(controls)||controls.length!==8)throw Error('Expected eight physical pitch controls');
 const ids=new Set(manifest.clips.map(c=>c.id));
 const sources=new Map();
 for(const c of controls){
  const cal=c.calibration,bins=cal?.measuredF0Hz,tone=cal?.imposedTone;
  if(c.role!=='calibration'||c.kind!=='character'||!/^\p{Script=Han}$/u.test(c.text)||!Number.isInteger(tone)||tone<1||tone>4||reading(c.pinyin).slice(-1)!==String(tone)||!path.isAbsolute(c.file)||!/^[-a-zA-Z0-9_]{1,128}$/.test(c.id)||ids.has(c.id)||cal.method!==controlManifest.method||cal.nativeCorrectnessVerified!==false||!Array.isArray(bins)||bins.length!==5||!bins.every(f=>Number.isFinite(f)&&f>0)||!/^[a-f0-9]{64}$/.test(cal.sourceSha256||'')||cal.sourceSha256===c.sha256||cal.measuredAudioSha256!==c.sha256)throw Error('Invalid physical pitch control');
  const rising=bins.slice(1).every((f,i)=>f>bins[i]),falling=bins.slice(1).every((f,i)=>f<bins[i]),dip=Math.min(...bins.slice(1,3));
  const shape=tone===1?Math.max(...bins)/Math.min(...bins)<1.08:tone===2?rising&&bins[4]/bins[0]>1.35:tone===3?dip/bins[0]<.9&&bins[4]/dip>1.4:falling&&bins[0]/bins[4]>1.4;
  if(!shape)throw Error('Measured physical control contour contradicts its label');
  ids.add(c.id);const now=availability(c.file,c.sha256);
  if(!/^[a-f0-9]{64}$/.test(c.sha256||'')||now.availability!=='available')throw Error('Physical pitch control bytes changed');
  const group=sources.get(cal.sourceSha256)||[];group.push(c);sources.set(cal.sourceSha256,group);
 }
 if(sources.size!==2||[...sources.values()].some(group=>group.length!==4||new Set(group.map(c=>c.calibration.imposedTone)).size!==4||new Set(group.map(c=>c.sha256)).size!==4||new Set(group.map(c=>c.text)).size!==1))throw Error('Physical controls need four distinct contours for each of two sources');
 return finish([...manifest.clips,...controls],{...manifest.source,physicalControls:controlManifest.method||'PSOLA pitch intervention'});
}
function summarizeAudit(manifest,report){
 const results=new Map();for(const r of report.results||[]){if(results.has(r.clipId))throw Error('Duplicate assessment result');results.set(r.clipId,r)}
 function evidence(c){
  const result=results.get(c.id),now=availability(c.file,c.expectedSha256);
  if(now.availability==='missing')return{status:'missing'};
  if(c.availability!=='available'||now.sha256!==c.sha256||result&&result.sha256!==c.sha256)return{status:'stale'};
  if(!result)return{status:'uncertain'};
  const p=result.provenance,response=result.response;
  if(report.provider!=='TonePerfect'||report.protocol!==PROTOCOL||p?.endpoint!==ENDPOINT||p?.protocol!==PROTOCOL||p?.realProviderCall!==true||p?.transport!=='native-fetch'||p?.referenceMode!==(c.kind==='character'?'pinyin-only':'characters-and-pinyin')||!p?.modelVersion||p.modelVersion!==response?.model_version||!Number.isFinite(Date.parse(p.retrievedAt))||response?.test===true)return{status:'uncertain',reasons:['Missing real provider evidence or incompatible provenance']};
  // Recompute from retained acoustic evidence; never trust a cached verdict or transcript.
  const a=classifyAssessment(response,{pinyin:c.pinyin,kind:c.kind}),components=a.components;
  if(!components||!['initial','final','tone'].every(k=>['matches','mismatch','uncertain'].includes(components[k])))return{status:'uncertain'};
  if(!['matches','mismatch','uncertain'].includes(a.status))return{status:'uncertain'};
  return{status:a.status,components,reasons:a.reasons||[],modelVersion:p.modelVersion,referenceMode:p.referenceMode,retrievedAt:p.retrievedAt};
 }
 const controls=manifest.clips.filter(c=>c.role==='control').map(c=>({id:c.id,...c.control,...evidence(c)}));
 for(const c of controls){const source=manifest.clips.find(s=>s.id===c.sourceId),s=source&&evidence(source);c.passed=c.status==='mismatch'&&c.components?.[c.component]==='mismatch'&&c.modelVersion===s?.modelVersion&&c.referenceMode===s?.referenceMode;}
 const candidates=manifest.clips.filter(c=>c.role==='candidate').map(c=>{
  const e=evidence(c),checks=controls.filter(k=>k.sourceId===c.id);
  let status=e.status;
  if(status==='matches')status=['initial','final','tone'].every(k=>e.components[k]==='matches')&&checks.length&&checks.every(k=>k.passed)?'candidate-matches':'uncertain';
  return{id:c.id,text:c.text,pinyin:c.pinyin,sha256:c.sha256,status,components:e.components,reasons:e.reasons,modelVersion:e.modelVersion,retrievedAt:e.retrievedAt,controls:{passed:checks.filter(k=>k.passed).length,total:checks.length}};
 });
 const calibration=manifest.clips.filter(c=>c.role==='calibration').map(c=>({id:c.id,imposedTone:c.calibration?.imposedTone,...evidence(c)}));
 const models=[...new Set(candidates.map(c=>c.modelVersion).filter(Boolean))];
 const calibrationPassed=calibration.length===8&&models.length===1&&[1,2,3,4].every(t=>calibration.filter(c=>c.imposedTone===t).length===2)&&calibration.every(c=>c.components?.tone==='matches'&&c.modelVersion===models[0]);
 return{schemaVersion:1,manifestId:manifest.id,provider:report.provider||null,canPromote:false,createdAt:new Date().toISOString(),
  note:'Candidate matches are diagnostic evidence. Judge calibration, independent references and synthesis rights remain separate release gates.',
  counts:candidates.reduce((counts,c)=>(counts[c.status]=(counts[c.status]||0)+1,counts),{}),
  judgeCalibration:{status:!calibration.length?'not-run':calibrationPassed?'passed':'failed-or-inconclusive',note:'Physical contour sanity checks, not a native-speaker accuracy benchmark.',results:calibration},
  controls:{total:controls.length,passed:controls.filter(c=>c.passed).length,failed:controls.filter(c=>!c.passed).length,results:controls},candidates};
}
function markdownReport(report){
 return '# Mandarin Grove audio diagnostics\n\n'+report.note+'\n\nNo audio promoted. Judge pitch calibration: '+report.judgeCalibration.status+'.\n\n| Character | Target | Result | Controls passed |\n|---|---|---|---|\n'+report.candidates.map(c=>`| ${c.text} | ${c.pinyin} | ${c.status} | ${c.controls.passed}/${c.controls.total} |`).join('\n')+'\n';
}
function acousticPreflight(manifest,python=process.env.AUDIO_PYTHON||'python3'){
 const clips=manifest.clips.filter(c=>c.availability==='available'),files=[...new Set(clips.map(c=>c.file))];
 if(!files.length)throw Error('No available audio to assess');
 const run=spawnSync(python,[path.join(__dirname,'audio-acoustics.py'),...files],{encoding:'utf8',maxBuffer:16*1024*1024});
 if(run.error||run.status!==0)throw Error('Acoustic preflight failed. Install Python NumPy and system libsndfile, or set AUDIO_PYTHON. No assessment requests made.');
 let report;try{report=JSON.parse(run.stdout)}catch{throw Error('Invalid acoustic preflight report; no assessment requests made')}
 for(const clip of clips){
  const row=report.files?.find(f=>path.resolve(f.path)===clip.file);
  if(!row||row.status!=='ok'||row.sha256!==clip.sha256)throw Error('Acoustic preflight could not verify audio bytes: '+clip.text);
  if(!(row.durationSeconds>=.15&&row.durationSeconds<=15))throw Error('This pilot accepts 0.15–15 second clips only, bounding each assessment to one credit: '+clip.text);
  if(row.flags?.some(f=>['silent','too_short','clipping','channel_cancellation'].includes(f)))throw Error('Audio quality needs attention before assessment: '+clip.text);
 }
 return report;
}
async function main(){
 const [command='plan',...args]=process.argv.slice(2),get=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1]};
 const folder=path.resolve(get('--out',path.join(__dirname,'../exports/audio-audit')));
 if(command==='plan'){
  const input=get('--generated-plan');let plan=input?createGeneratedAudit(JSON.parse(fs.readFileSync(input)),{audioDir:path.dirname(path.resolve(input))}):createBundledAudit(require('../data/speech-pilot.json'),{characters:get('--characters')?[...get('--characters')]:DEFAULT_CHARACTERS});
  if(get('--tone-controls'))plan=withToneControls(plan,JSON.parse(fs.readFileSync(get('--tone-controls'))));
  fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(plan,null,2)+'\n');
  const available=plan.clips.filter(c=>c.availability==='available').length;
  console.log(`${plan.clips.filter(c=>c.role==='candidate').length} candidate readings; ${plan.clips.filter(c=>c.role==='control').length} contradictory controls; ${available} available assessments. No network requests.\nManifest: ${folder}/manifest.json`);
 }else if(command==='assess'){
  const {assessClips}=require('./audio-assessment.cjs'),manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
  const maxRequests=Number(get('--max-requests'));
  if(!Number.isSafeInteger(maxRequests)||maxRequests<1)throw Error('Set --max-requests to an explicit positive integer');
  const keyFile=get('--key-file'),apiKey=keyFile?fs.readFileSync(path.resolve(keyFile),'utf8').trim():process.env.TONEPERFECT_API_KEY;
  if(!apiKey)throw Error('Set TONEPERFECT_API_KEY or --key-file locally; never paste a key into chat or the app');
  const acoustic=acousticPreflight(manifest);fs.writeFileSync(path.join(folder,'acoustics.json'),JSON.stringify(acoustic,null,2)+'\n');
  const results=await assessClips(manifest.clips.filter(c=>c.availability==='available'),path.join(folder,'assessments'),{apiKey,maxRequests});
  fs.writeFileSync(path.join(folder,'assessments.json'),JSON.stringify(results,null,2)+'\n');
  const report=summarizeAudit(manifest,results);fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(folder,'report.md'),markdownReport(report));
  console.log(JSON.stringify({requests:results.requests,counts:report.counts,controls:{passed:report.controls.passed,total:report.controls.total},report:path.join(folder,'report.md'),canPromote:false}));
 }else if(command==='report'){
  const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'))),input=JSON.parse(fs.readFileSync(get('--results',path.join(folder,'assessments.json'))));
  const report=summarizeAudit(manifest,input);fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(folder,'report.md'),markdownReport(report));console.log(path.join(folder,'report.md'));
 }else throw Error('Use plan, assess --max-requests N, or report');
}
module.exports={createBundledAudit,createGeneratedAudit,withToneControls,summarizeAudit,markdownReport,acousticPreflight};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1});
