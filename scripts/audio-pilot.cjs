// Release-time audio preparation. No credentials or model calls run when imported.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const xml=value=>value.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
const VOICES=['cmn-CN-Wavenet-A','cmn-CN-Wavenet-B','cmn-CN-Wavenet-C','cmn-CN-Wavenet-D'];
function numberedPinyin(value){
 return value.trim().toLowerCase().split(/\s+/).map(syllable=>{
  const letters=syllable.normalize('NFD').replace(/u\u0308/g,'ü');
  const tones=[...letters].filter(ch=>'\u0304\u0301\u030c\u0300'.includes(ch));
  const base=letters.replace(/[\u0300-\u036f]/g,'');
  if(!/^[a-zü]+$/.test(base)||tones.length>1)throw Error('Invalid pinyin syllable: '+syllable);
  return base+(tones.length?'\u0304\u0301\u030c\u0300'.indexOf(tones[0])+1:5);
 }).join(' ');
}
function createAudioPlan(dataset,voices=['cmn-CN-Wavenet-A','cmn-CN-Wavenet-B']){
 if(!Array.isArray(dataset.cases)||!dataset.cases.length||!voices.length||new Set(voices).size!==voices.length||voices.some(v=>!VOICES.includes(v)))throw Error('A nonempty set and supported Mandarin WaveNet voices are required');
 const ids=new Set(),clips=[];
 for(const entry of dataset.cases){
  if(!/^[a-z0-9-]+$/.test(entry.id)||ids.has(entry.id))throw Error('Invalid or duplicate case ID');ids.add(entry.id);
  const phonemes=numberedPinyin(entry.pinyin),characters=[...entry.text].filter(ch=>/\p{Script=Han}/u.test(ch));
  if(characters.length!==phonemes.split(' ').length||!['character','sentence'].includes(entry.kind))throw Error('Reading/text length mismatch: '+entry.id);
  const input=entry.kind==='character'?{ssml:`<speak><phoneme alphabet="pinyin" ph="${xml(phonemes)}">${xml(entry.text)}</phoneme></speak>`}:{text:entry.text};
  for(const voice of voices){
   const request={input,voice:{languageCode:'cmn-CN',name:voice},audioConfig:{audioEncoding:'MP3',speakingRate:1}};
   const id=digest(JSON.stringify({text:entry.text,pinyin:phonemes,request,pipeline:1})).slice(0,24);
   clips.push({id,caseId:entry.id,text:entry.text,pinyin:entry.pinyin,phonemes,kind:entry.kind,meaning:entry.meaning,notes:entry.notes||'',readingReview:entry.readingReview||'pending',voice,request,file:id+'.mp3',review:{status:'pending'}});
  }
 }
 const totalCharacters=clips.reduce((n,c)=>n+[...(c.request.input.ssml||c.request.input.text)].length,0);
 return {schemaVersion:1,id:digest(JSON.stringify(clips)).slice(0,24),datasetVersion:dataset.version,createdAt:new Date().toISOString(),pricing:{checked:'2026-10-20',usdPerMillion:4,source:'https://cloud.google.com/text-to-speech/pricing',freeQuotaAssumed:false},totalCharacters,estimatedUSD:totalCharacters*4/1e6,clips};
}
function reviewedClips(plan,report){
 if(report.planId!==plan.id)throw Error('Review is for a different generation plan');
 return plan.clips.filter(clip=>clip.sha256&&report.judgements?.[clip.id]?.status==='approved'&&report.judgements[clip.id].sha256===clip.sha256);
}
function reviewPage(plan){
 const embedded=JSON.stringify(plan).replace(/</g,'\\u003c');
 return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mandarin Grove · Audio pilot</title>
<style>:root{color-scheme:light dark}body{font:17px/1.5 system-ui;max-width:1000px;margin:auto;padding:20px;background:light-dark(#f4f1ea,#14161c);color:light-dark(#24271f,#f4f1ea)}h1{color:#f97316}article{border:1px solid #8886;border-radius:16px;padding:16px;margin:14px 0}h2{margin:0;font-size:24px}small{display:block}audio{max-width:100%;margin:10px 0}button,select,textarea{font:inherit;min-height:44px;max-width:100%}textarea{width:100%;box-sizing:border-box}button{background:#ad96dc;color:#14161c;border:0;border-radius:10px;padding:10px;cursor:pointer}.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.note{color:light-dark(#555,#ccc)}</style>
<h1>Mandarin Grove · Audio pilot</h1><p>Compare intended readings with what you hear. Natural tone changes and regional variants need a fluent speaker’s judgment. Choose “Sounds right” only after checking the printed reading and listening to the clip. These clips are candidates; none become practice defaults here.</p><p class="note">No recordings or reviews are uploaded. Export your review before closing this page. With no generated audio, this page is a preview and rating controls stay disabled.</p><button id="export">Download review</button><p id="status" role="status"></p><main id="clips"></main>
<script>const plan=${embedded};const key='grove_audio_review_'+plan.id;let report={schemaVersion:1,planId:plan.id,judgements:{}};try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.planId===plan.id)report=saved}catch{}const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};function save(){try{localStorage.setItem(key,JSON.stringify(report));document.querySelector('#status').textContent='Review saved in this browser.'}catch{document.querySelector('#status').textContent='Browser storage unavailable. Download your review to keep it.'}}for(const c of plan.clips){if(report.judgements[c.id]?.sha256!==c.sha256)delete report.judgements[c.id];const a=el('article');a.append(el('h2',c.text+' · '+c.pinyin),el('small',c.meaning+' · '+c.voice),el('p',c.notes||'Check the consonants, vowel, tone and clarity.'));if(c.sha256){const audio=el('audio');audio.controls=true;audio.preload='none';audio.src=c.file;a.append(audio)}else a.append(el('p','Audio not generated yet.'));const row=el('div');row.className='row';const label=el('label','Your listening judgment '),select=el('select');select.setAttribute('aria-label',c.text+' '+c.voice+' listening judgment');for(const [value,text]of [['pending','Not reviewed'],['approved','Sounds right'],['rejected','Needs work'],['unsure','Unsure']]){const o=el('option',text);o.value=value;select.append(o)}select.value=report.judgements[c.id]?.status||'pending';select.disabled=!c.sha256;label.append(select);row.append(label);a.append(row);const notes=el('textarea');notes.placeholder='What sounded wrong, or what needs a second opinion?';notes.setAttribute('aria-label',c.text+' '+c.voice+' review notes');notes.value=report.judgements[c.id]?.note||'';const update=()=>{report.judgements[c.id]={status:select.value,note:notes.value,sha256:c.sha256||null};save()};select.onchange=update;notes.oninput=update;a.append(notes);document.querySelector('#clips').append(a)}document.querySelector('#export').onclick=()=>{const a=el('a');const u=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));a.href=u;a.download='audio-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};</script></html>`;
}
function writePlan(folder,plan){fs.writeFileSync(path.join(folder,'plan.json'),JSON.stringify(plan,null,2)+'\n');fs.writeFileSync(path.join(folder,'review.html'),reviewPage(plan));}
async function synthesizePlan(plan,folder,{apiKey,accessToken,maxCharacters=20000,fetchImpl=fetch}={}){
 if(!apiKey&&!accessToken)throw Error('Set GOOGLE_TTS_API_KEY or GOOGLE_TTS_ACCESS_TOKEN locally; never put it in the app');
 const total=plan.clips.reduce((count,clip)=>{
  if(!/^[a-f0-9]{24}$/.test(clip.id)||clip.file!==clip.id+'.mp3'||!VOICES.includes(clip.voice)||clip.request.voice.name!==clip.voice)throw Error('Invalid audio plan entry');
  const input=clip.request.input.ssml||clip.request.input.text;if(typeof input!=='string')throw Error('Invalid synthesis input');return count+[...input].length;
 },0);
 if(!(maxCharacters>0)||total>maxCharacters)throw Error('Generation exceeds the explicit character budget');
 const headers={'Content-Type':'application/json',...(apiKey?{'X-Goog-Api-Key':apiKey}:{Authorization:'Bearer '+accessToken})};
 for(const clip of plan.clips){
  const file=path.join(folder,clip.file);
  if(clip.sha256&&fs.existsSync(file)&&digest(fs.readFileSync(file))===clip.sha256)continue;
  const response=await fetchImpl('https://texttospeech.googleapis.com/v1/text:synthesize',{method:'POST',headers,body:JSON.stringify(clip.request),signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error('Synthesis failed (HTTP '+response.status+'). Credentials and response body omitted.');
  const data=await response.json();if(typeof data.audioContent!=='string'||!data.audioContent)throw Error('Synthesis returned no audio');
  const bytes=Buffer.from(data.audioContent,'base64');if(bytes.length<32)throw Error('Synthesis returned empty/invalid audio');
  fs.writeFileSync(file+'.tmp',bytes);fs.renameSync(file+'.tmp',file);clip.sha256=digest(bytes);clip.generatedAt=new Date().toISOString();
  writePlan(folder,plan); // Checkpoint each paid request; a resumed run skips matching audio.
 }
 return plan;
}
async function main(){
 const [command='plan',...args]=process.argv.slice(2),get=(name,fallback)=>{const at=args.indexOf(name);return at>=0?args[at+1]:fallback};
 const folder=path.resolve(get('--out',path.join(__dirname,'../exports/audio-pilot')));fs.mkdirSync(folder,{recursive:true});
 if(command==='plan'){
  const dataset=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/speech-pilot.json'),'utf8'));
  const plan=createAudioPlan(dataset);writePlan(folder,plan);
  console.log(`${plan.clips.length} candidate clips; ${plan.totalCharacters} billable input characters; estimated $${plan.estimatedUSD.toFixed(4)} before any free allowance. No synthesis performed.\nReview preview: ${folder}/review.html`);
 }else if(command==='generate'){
  const plan=JSON.parse(fs.readFileSync(path.join(folder,'plan.json'),'utf8'));
  await synthesizePlan(plan,folder,{apiKey:process.env.GOOGLE_TTS_API_KEY,accessToken:process.env.GOOGLE_TTS_ACCESS_TOKEN,maxCharacters:Number(get('--max-characters','20000'))});
  console.log('Candidate audio ready for listening review: '+folder+'/review.html');
 }else if(command==='promote'){
  const plan=JSON.parse(fs.readFileSync(path.join(folder,'plan.json'),'utf8')),review=JSON.parse(fs.readFileSync(get('--review',''),'utf8')),approved=reviewedClips(plan,review),dest=path.resolve(get('--dest',path.join(__dirname,'../exports/audio-approved')));
  if(!approved.length)throw Error('No matching approved audio in this review');fs.mkdirSync(dest,{recursive:true});
  for(const clip of approved){const bytes=fs.readFileSync(path.join(folder,clip.file));if(digest(bytes)!==clip.sha256)throw Error('Audio changed since review: '+clip.id);}
  for(const clip of approved)fs.copyFileSync(path.join(folder,clip.file),path.join(dest,clip.file));
  fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify({schemaVersion:1,planId:plan.id,clips:approved.map(c=>({...c,request:undefined,review:{...review.judgements[c.id],reviewedAt:new Date().toISOString()}}))},null,2)+'\n');console.log(approved.length+' reviewed clips staged in '+dest+'; app defaults unchanged.');
 }else throw Error('Use plan, generate, or promote');
}
module.exports={numberedPinyin,createAudioPlan,reviewedClips,reviewPage,synthesizePlan};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1});
