// Speech is device-specific; keep this preference separate from kid backups.
let speechSequence = 0, activeAudio = null, activeUtterance = null, speechFinish = null;
const ENGLISH_PROMPTS = {
  en_listen: 'Listen, then tap the character you hear.', en_trace: 'Follow the strokes to trace the character.',
  en_flip: 'Tap the card to flip it.', en_who: "Who is practicing?", en_new: 'New characters to practice!'
};
function browserVoices() {
  return window.speechSynthesis ? speechSynthesis.getVoices() : [];
}
function isMandarinVoice(v) {
  const lang=String(v.lang||'').replace(/_/g,'-').toLowerCase();
  if (/^cmn(?:-|$)/.test(lang)) return true;
  if (/(?:^|-)(?:hk|mo|yue)(?:-|$)/.test(lang)) return false;
  return /^zh(?:$|-(?:cn|tw|sg|hans|hant)(?:-|$))/.test(lang);
}
function voiceKey(v) {
  return 'voice:'+encodeURIComponent(JSON.stringify([v.voiceURI,v.lang,v.name,!!v.localService]));
}
function mandarinVoices() {
  const unique=new Map();
  for (const voice of browserVoices().filter(isMandarinVoice)) {
    const key=voiceKey(voice);
    if (!unique.has(key) || voice.default) unique.set(key,voice);
  }
  return [...unique.values()];
}
function voiceLabel(voice, voices=mandarinVoices()) {
  const sameName=voices.filter(v=>v.name===voice.name&&v.lang===voice.lang);
  const index=sameName.findIndex(v=>voiceKey(v)===voiceKey(voice));
  return `${voice.name} · ${voice.lang}${sameName.length>1?' · variant '+(index+1):''}`;
}
function hasMainlandRecordings() {
  return typeof MAINLAND_AUDIO!=='undefined' && Object.keys(MAINLAND_AUDIO.readings).length>0;
}
function expectsMainlandRecordings() {
  return document.body?.dataset?.mainlandRecordings==='true' || hasMainlandRecordings();
}
function voicePreference() { return localStorage.getItem('zh_voice') || (expectsMainlandRecordings()?'mainland':'auto'); }
function selectedMandarinVoice() {
  const preference=voicePreference();
  if (['auto','recorded','reference','mainland'].includes(preference)) return null;
  // Preserve preferences saved by earlier versions, which stored just voiceURI.
  return mandarinVoices().find(v=>voiceKey(v)===preference||v.voiceURI===preference)||null;
}
function voiceReport() {
  return JSON.stringify({selection:voicePreference(), voices:browserVoices().map(v=>({
    name:v.name,lang:v.lang,voiceURI:v.voiceURI,localService:!!v.localService,default:!!v.default,mandarin:isMandarinVoice(v)
  }))},null,2);
}
function speechStatus(message) {
  const dialogs=[...(document.querySelectorAll?.('dialog[open],[role="dialog"][aria-modal="true"]')||[])];
  const dialog=dialogs.filter(el=>el.getClientRects().length).at(-1);
  for(const status of document.querySelectorAll?.('[data-speech-status]')||[]){status.textContent='';status.hidden=true;}
  const element = document.getElementById('speech-status');
  if (element) { element.textContent = message; element.hidden = !message||!!dialog; }
  if(dialog&&message){
    let status=dialog.querySelector('[data-speech-status]');
    if(!status){
      status=document.createElement('p');status.className='reading-note';status.dataset.speechStatus='';status.setAttribute('role','status');
      (dialog.querySelector('.detail-reading,.lookup-detail-actions')||dialog).append(status);
    }
    status.textContent=message;status.hidden=false;
  }
}
function stopSpeech() {
  speechStatus('');
  speechSequence++;
  if (activeAudio) { activeAudio.pause(); activeAudio = null; }
  if (speechFinish) { const finish = speechFinish; speechFinish = null; finish(false); }
  if (window.speechSynthesis) speechSynthesis.cancel();
  activeUtterance = null;
}
function speakDevice(text, token, english = false) {
  if (token !== speechSequence || !window.speechSynthesis) return Promise.resolve(false);
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    activeUtterance = u;
    u.lang = english ? 'en-US' : 'zh-CN';
    u.rate = english ? 0.9 : 0.75;
    const voice = english ? speechSynthesis.getVoices().find(v => /^en[-_]/i.test(v.lang)) : selectedMandarinVoice();
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    const done = ok => {
      if (speechFinish === done) speechFinish = null;
      if (activeUtterance === u) activeUtterance = null;
      resolve(ok && token === speechSequence);
    };
    speechFinish = done;
    u.onend = () => done(true); u.onerror = () => done(false);
    try { speechSynthesis.speak(u); } catch (_) { done(false); }
  });
}
function recordingKey(pinyin) {
  return pinyinBase(pinyin.trim()) + (pinyinTone(pinyin) || 5);
}
function referenceRecording(card, reading) {
  const expected=reading || readings(card)[0];
  if (!readings(card).includes(expected)) return null;
  const file=typeof REFERENCE_AUDIO==='undefined' ? null : REFERENCE_AUDIO.readings[recordingKey(expected)];
  return file ? {file,pinyin:expected} : null;
}
function mainlandRecording(card, reading) {
  const expected=reading || readings(card)[0];
  if (!readings(card).includes(expected)) return null;
  const file=typeof MAINLAND_AUDIO==='undefined' ? null : MAINLAND_AUDIO.readings[recordingKey(expected)];
  return file ? {file,pinyin:expected} : null;
}
function uncheckedNeutralRecording(card, reading) {
  // Recovered Google clips are optional unchecked audio, never part of the
  // approved Mainland mapping. Keep polyphonic filenames out of other readings.
  const characters={a5:'啊',ba5:'吧',de5:'的',le5:'了',ma5:'吗',me5:'么',men5:'们',ne5:'呢',zhe5:'着'};
  return characters[recordingKey(reading)]===card.c ? 'audio/'+encodeURIComponent(card.c)+'.mp3' : null;
}
function playRecording(text, token, file) {
  return new Promise(resolve => {
    const a = new Audio(file || 'audio/' + encodeURIComponent(text) + '.mp3');
    activeAudio = a;
    let settled = false;
    const done = ok => {
      if (settled) return; settled = true;
      if (speechFinish === done) speechFinish = null;
      if (activeAudio === a) activeAudio = null;
      resolve(ok && token === speechSequence);
    };
    speechFinish = done;
    a.onended = () => done(true); a.onerror = () => done(false);
    try { a.play().catch(() => done(false)); } catch (_) { done(false); }
  });
}
async function speakPrompt(text, token, reading) {
  const english = ENGLISH_PROMPTS[text];
  const card = ALL.find(c => c.c === text);
  const prompt = english || (card ? speechText(card) : text);
  const preference=voicePreference();
  if (!english && !card) {
    const voice=selectedMandarinVoice();
    window.lastSpeechRequest={character:text,pinyin:reading||null,prompt:text,preference,
      voice:voice?{name:voice.name,lang:voice.lang,uri:voice.voiceURI}:null,source:'browser speech',
      selectionNote:'Dictionary word or character without a bundled recording; requests browser Mandarin. Actual pronunciation is not verified.'};
    if(!window.speechSynthesis){speechStatus('No recording is available for this word or character, and browser speech is unavailable on this device.');return false;}
    // Start within the deliberate button gesture: waiting for a nonexistent MP3 can lose Safari user activation.
    if(['reference','recorded','mainland'].includes(preference))speechStatus('No recording for this word or character. Using the device voice.');
    const ok=await speakDevice(prompt,token);
    if(!ok&&token===speechSequence)speechStatus('Could not play this browser voice. Try again, or choose a voice in Grown-ups.');
    return ok;
  }
  if (card && preference==='mainland') {
    if(!hasMainlandRecordings()){
      speechStatus('The recording list could not load. Reload and try again.');
      return false;
    }
    const expected=reading||readings(card)[0];
    if (!readings(card).includes(expected)) {
      speechStatus('This reading is not listed for this character. Choose a listed reading.');
      return false;
    }
    const recording=mainlandRecording(card,expected);
    const sourceReviewed=MAINLAND_AUDIO.acceptanceBasis==='native-source-review';
    const checkPending=MAINLAND_AUDIO.pendingReadings?.includes(recordingKey(expected));
    window.lastSpeechRequest={character:text,pinyin:expected,prompt:recording?text:prompt,preference,
      voice:null,source:recording?'MSU Putonghua recording':'browser speech',recording:recording?.file||null,
      selectionNote:recording?(sourceReviewed?'MSU native-source review; automatic pronunciation checker is not qualified. '+(checkPending?'Additional component check pending. ':'Three app component checks match; this is not a correctness guarantee. '):'Native-source isolated recording with separate calibrated consonant, vowel and tone checks. ')+'Exact source and limits in audio-sources/mainland.json.':'No source recording for this reading; device voice pronunciation is not verified.'};
    if (!recording) {
      if(expected!==readings(card)[0]){speechStatus('No checked recording for this alternate reading yet. Choose another pronunciation voice in Grown-ups.');return false;}
      const unchecked=uncheckedNeutralRecording(card,expected);
      if(unchecked){
        window.lastSpeechRequest={...window.lastSpeechRequest,source:'Google recording · unchecked',recording:unchecked,
          selectionNote:'Existing recovered Google clip; this reading has not passed pronunciation verification.'};
        speechStatus('Older Google recording · pronunciation unchecked.');
        const ok=await playRecording(text,token,unchecked);
        if(ok||token!==speechSequence)return ok;
        window.lastSpeechRequest={...window.lastSpeechRequest,source:'browser speech',recording:null,
          selectionNote:'Unchecked Google clip could not play; device voice pronunciation is not verified.'};
        speechStatus('Playing the device voice · pronunciation unchecked.');
      }
      if(!window.speechSynthesis){speechStatus('No checked recording for this reading yet, and the device voice is unavailable.');return false;}
      if(!unchecked)speechStatus('No checked recording for this reading yet. Playing the device voice · pronunciation unchecked.');
      const ok=await speakDevice(prompt,token);
      if(!ok&&token===speechSequence)speechStatus('Could not play the device voice. Try again, or choose a voice in Grown-ups.');
      return ok;
    }
    speechStatus(checkPending?'MSU recording · additional pronunciation check pending.':'');
    const ok=await playRecording(text,token,recording.file);
    if(!ok&&token===speechSequence)speechStatus('Recording could not play. Tap the speaker to retry, or choose another pronunciation voice in Grown-ups.');
    return ok;
  }
  if (card && preference==='reference') {
    const recording=referenceRecording(card,reading);
    window.lastSpeechRequest={character:text,pinyin:reading||readings(card)[0],prompt:text,preference,
      voice:null,source:'CNS11643 reference recording',recording:recording?.file||null,
      selectionNote:'Taiwan Mandarin published reference, not verified as Mainland pronunciation; exact reading and file provenance in audio-sources/cns11643.json.'};
    if (!recording) {
      speechStatus('No reference recording for this reading. Choose another pronunciation voice in Grown-ups.');
      return false;
    }
    const ok=await playRecording(text,token,recording.file);
    if (!ok && token===speechSequence) speechStatus('Recording could not play. Tap the speaker to retry, or choose another pronunciation voice in Grown-ups.');
    return ok;
  }
  if(card){const voice=selectedMandarinVoice();window.lastSpeechRequest={character:text,pinyin:reading||readings(card)[0],prompt,preference,voice:voice?{name:voice.name,lang:voice.lang,uri:voice.voiceURI}:null,source:preference==='recorded'||!window.speechSynthesis?'Google Cloud TTS bundled recording (device fallback if unavailable)':'browser speech',selectionNote:'Requested voice; actual browser audio is not verified.'};}
  if (!english && preference !== 'recorded' && preference !== 'reference' && window.speechSynthesis) {
    if(card)speechStatus('Device voice · pronunciation unchecked.');
    const ok = await speakDevice(prompt, token);
    // Do not substitute a potentially different recording after cancelled speech.
    if (!ok && token === speechSequence) speechStatus('Could not play this voice. Tap the speaker to retry, or choose another voice in Grown-ups.');
    return ok;
  }
  if(card&&preference==='recorded')speechStatus('Older Google recording · pronunciation unchecked.');
  const ok = await playRecording(text, token);
  if (!ok && token === speechSequence) return speakDevice(prompt, token, !!english);
  return ok;
}
function say(text, reading) {
  stopSpeech();
  return speakPrompt(text, speechSequence, reading);
}
async function sayThen(first, second) {
  stopSpeech();
  const token = speechSequence;
  if (await speakPrompt(first, token) && token === speechSequence) await speakPrompt(second, token);
}
function voiceEscape(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function voiceSettingsMarkup() {
  return `<label class="voice-label" for="voice-choice">Pronunciation voice</label>
    <select id="voice-choice" class="voice-choice"></select>
    <p id="voice-note" class="reading-note" role="status"></p>
    <button type="button" class="btn" id="voice-preview">Play 狗 · 子 · 假 · 满</button>
    <button type="button" class="btn gray" id="voice-refresh">Refresh voices</button>
    <p class="reading-note" data-speech-status role="status" hidden></p>
    <p class="reading-note">The app targets Mainland Mandarin (Putonghua) and simplified Chinese. CNS11643 recordings are Taiwan Mandarin and remain an optional regional voice, not a verified Mainland pronunciation model. The older Google Cloud TTS recordings remain available. Browser voices can choose a different reading or tone. Reference recordings cover school characters; longer words and instructions may use other audio.</p>
    ${expectsMainlandRecordings()?'<p class="reading-note">MSU audio: Tone Perfect MP3 Dataset, Michigan State University Libraries, East Lansing, MI. Selected recordings are unchanged and used under <a href="audio-sources/LICENSE-MSU.txt" target="_blank" rel="noopener">CC BY-NC 4.0 · citation and license</a>. <a href="audio-sources/MSU-VERIFICATION.json" target="_blank" rel="noopener">Source and remaining checks</a>.</p>':''}
    <p class="reading-note">Downloaded iPhone/iPad Accessibility voices may not be available to websites. If Lanlan is missing, try the browser default; the browser still decides which voice it uses. This may differ from the voice enabled in iOS Settings. This setting saves immediately.</p>
    <details><summary class="reading-note">Browser voice report</summary>
      <p class="reading-note">This lists every voice the browser reports, before filtering. If a downloaded voice is absent here, this page cannot select it by name. You can copy this report to help troubleshoot.</p>
      <textarea id="voice-report" aria-label="Browser voice report" readonly style="width:100%;height:180px;user-select:text;-webkit-user-select:text;font-size:13px"></textarea>
    </details>`;
}
function refreshVoiceSettings() {
  const select = document.getElementById('voice-choice'); if (!select) return;
  const voices = mandarinVoices(), preference = voicePreference(), selected=selectedMandarinVoice();
  const available = ['auto','recorded','reference','mainland'].includes(preference)||!!selected;
  const html=(expectsMainlandRecordings()?'<option value="mainland">MSU Mainland recordings</option>':'')+
    '<option value="auto">Mainland Mandarin · browser default</option><option value="reference">Taiwan Mandarin recordings · optional</option><option value="recorded">Google Cloud TTS recordings</option>' +
    voices.map(v => `<option value="${voiceEscape(voiceKey(v))}">${voiceEscape(voiceLabel(v,voices))}</option>`).join('') +
    (!available?`<option value="${voiceEscape(preference)}" disabled>Saved voice unavailable · browser default used</option>`:'');
  // Avoid rebuilding an unchanged native iOS picker during catalog refreshes.
  if (select._voiceOptions!==html) { select.innerHTML=html; select._voiceOptions=html; }
  select.value = selected ? voiceKey(selected) : preference;
  const note=document.getElementById('voice-note');
  note.textContent = preference === 'mainland'
    ? 'Native Putonghua recordings from MSU Tone Perfect, reviewed by the source team. Additional app checks remain unfinished; some readings are marked for an extra check. Nine neutral-tone gaps may use older Google or device audio, marked unchecked, including in listening activities. Other words and sentences use the device voice. Your saved voice choices are preserved.'
    : preference === 'reference'
    ? 'Taiwan Mandarin recordings from CNS11643, matched to the pinyin shown; not verified as Mainland pronunciation. Your saved choice is preserved. Plays bundled files without a speech service.'
    : preference === 'recorded'
    ? 'Plays the bundled Google Cloud Text-to-Speech audio. This does not use your downloaded iOS voices.'
    : !window.speechSynthesis ? 'Browser speech is unavailable. Optional Taiwan Mandarin or older Google Cloud TTS recordings are available; neither is a newly verified Mainland voice.'
    : !available ? 'The saved voice is not currently exposed by this browser. Playback uses the browser’s Mandarin default instead.'
    : preference==='auto' ? 'Requests Mainland Mandarin (zh-CN). The browser chooses the voice; its actual pronunciation is not verified. This does not force Tingting or follow your Accessibility voice setting.'
    : `Requested voice: ${voiceLabel(selected,voices)}. Use the sample to check how this browser actually sounds.`;
  const report=document.getElementById('voice-report');if(report)report.value=voiceReport();
}
let voiceRefreshTimers=[];
function refreshVoiceCatalog() {
  voiceRefreshTimers.forEach(clearTimeout);voiceRefreshTimers=[];
  refreshVoiceSettings();
  // Some browsers populate the catalog after the first request or on returning from Settings.
  if (!document.getElementById('voice-choice')) return;
  for (const delay of [250,1000,2500]) voiceRefreshTimers.push(setTimeout(refreshVoiceSettings,delay));
}
function bindVoiceSettings() {
  refreshVoiceCatalog();
  document.getElementById('voice-choice').onchange = e => {
    stopSpeech();let status=document.getElementById('voice-save-status');
    if(!status){status=document.createElement('p');status.id='voice-save-status';status.className='reading-note';status.setAttribute('role','status');e.target.after(status);}
    try{localStorage.setItem('zh_voice',e.target.value);status.textContent='Saved on this device.';}
    catch{status.textContent='Could not save the voice preference. Your previous choice is kept. Please try again.';}
    refreshVoiceSettings();
  };
  document.getElementById('voice-refresh').onclick = refreshVoiceCatalog;
  document.getElementById('voice-preview').onclick = async () => {
    stopSpeech(); const token = speechSequence;
    for (const text of ['狗','子','假','满']) {
      if (token !== speechSequence || !await speakPrompt(text, token)) break;
    }
  };
}
if (window.speechSynthesis) speechSynthesis.addEventListener('voiceschanged', refreshVoiceSettings);

if (window.addEventListener) {
  window.addEventListener('focus',refreshVoiceCatalog);
  window.addEventListener('pageshow',refreshVoiceCatalog);
}
if (document.addEventListener) document.addEventListener('visibilitychange',()=>{
  if (!document.hidden) refreshVoiceCatalog();
});
