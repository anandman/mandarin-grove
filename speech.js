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
function voicePreference() { return localStorage.getItem('zh_voice') || 'auto'; }
function selectedMandarinVoice() {
  const preference=voicePreference();
  if (preference==='auto' || preference==='recorded') return null;
  // Preserve preferences saved by earlier versions, which stored just voiceURI.
  return mandarinVoices().find(v=>voiceKey(v)===preference||v.voiceURI===preference)||null;
}
function voiceReport() {
  return JSON.stringify({selection:voicePreference(), voices:browserVoices().map(v=>({
    name:v.name,lang:v.lang,voiceURI:v.voiceURI,localService:!!v.localService,default:!!v.default,mandarin:isMandarinVoice(v)
  }))},null,2);
}
function speechStatus(message) {
  const element = document.getElementById('speech-status');
  if (element) { element.textContent = message; element.hidden = !message; }
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
function playRecording(text, token) {
  return new Promise(resolve => {
    const a = new Audio('audio/' + encodeURIComponent(text) + '.mp3');
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
async function speakPrompt(text, token) {
  const english = ENGLISH_PROMPTS[text];
  const card = ALL.find(c => c.c === text);
  const prompt = english || (card ? speechText(card) : text);
  if(card){const voice=selectedMandarinVoice();window.lastSpeechRequest={character:text,prompt,preference:voicePreference(),voice:voice?{name:voice.name,lang:voice.lang,uri:voice.voiceURI}:null,source:voicePreference()==='recorded'||!window.speechSynthesis?'bundled recording (device fallback if unavailable)':'browser speech',selectionNote:'Requested voice; actual browser audio is not verified.'};}
  if (!english && voicePreference() !== 'recorded' && window.speechSynthesis) {
    const ok = await speakDevice(prompt, token);
    // Do not substitute a potentially different recording after cancelled speech.
    if (!ok && token === speechSequence) speechStatus('Could not play this voice. Tap the speaker to retry, or choose another voice in Grown-ups.');
    return ok;
  }
  const ok = await playRecording(text, token);
  if (!ok && token === speechSequence) return speakDevice(prompt, token, !!english);
  return ok;
}
function say(text) {
  stopSpeech();
  return speakPrompt(text, speechSequence);
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
    <p class="reading-note">Google Cloud TTS recordings are the audio files bundled with this app. The other choices use browser speech.</p>
    <p class="reading-note">Downloaded iPhone/iPad Accessibility voices may not be available to websites. If Lanlan is missing, try Browser default Mandarin; the browser still decides which voice it uses. This may differ from the voice enabled in iOS Settings. This setting saves immediately.</p>
    <details><summary class="reading-note">Browser voice report</summary>
      <p class="reading-note">This lists every voice the browser reports, before filtering. If a downloaded voice is absent here, this page cannot select it by name. You can copy this report to help troubleshoot.</p>
      <textarea id="voice-report" aria-label="Browser voice report" readonly style="width:100%;height:180px;user-select:text;-webkit-user-select:text;font-size:13px"></textarea>
    </details>`;
}
function refreshVoiceSettings() {
  const select = document.getElementById('voice-choice'); if (!select) return;
  const voices = mandarinVoices(), preference = voicePreference(), selected=selectedMandarinVoice();
  const available = preference==='auto'||preference==='recorded'||!!selected;
  const html='<option value="auto">Browser default Mandarin</option><option value="recorded">Google Cloud TTS recordings</option>' +
    voices.map(v => `<option value="${voiceEscape(voiceKey(v))}">${voiceEscape(voiceLabel(v,voices))}</option>`).join('') +
    (!available?`<option value="${voiceEscape(preference)}" disabled>Saved voice unavailable · browser default used</option>`:'');
  // Avoid rebuilding an unchanged native iOS picker during catalog refreshes.
  if (select._voiceOptions!==html) { select.innerHTML=html; select._voiceOptions=html; }
  select.value = selected ? voiceKey(selected) : preference;
  const note=document.getElementById('voice-note');
  note.textContent = preference === 'recorded'
    ? 'Plays the bundled Google Cloud Text-to-Speech audio. This does not use your downloaded iOS voices.'
    : !window.speechSynthesis ? 'Browser speech is unavailable. Using Google Cloud TTS recordings.'
    : !available ? 'The saved voice is not currently exposed by this browser. Playback uses the browser’s Mandarin default instead.'
    : preference==='auto' ? 'The browser chooses its default voice for Mandarin (zh-CN). The app does not force Tingting or follow your Accessibility voice setting.'
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
  document.getElementById('voice-choice').onchange = e => { stopSpeech(); localStorage.setItem('zh_voice', e.target.value); refreshVoiceSettings(); };
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
