const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function harness(voice='auto',mainland=false) {
 const spoken=[],audio=[],saved=new Map(voice===null?[]:[['zh_voice',voice]]),events={};
 const voices=[{name:'Mandarin',lang:'zh-CN',voiceURI:'mandarin',localService:true},{name:'Cantonese',lang:'zh-HK',voiceURI:'cantonese'}];
 const synth={getVoices:()=>voices,cancel(){},speak(u){spoken.push(u)},addEventListener(n,f){events[n]=f}};
 class Audio {constructor(url){this.url=url;audio.push(this)}play(){return Promise.resolve()}pause(){this.paused=true}}
 const ctx=vm.createContext({window:{speechSynthesis:synth},speechSynthesis:synth,SpeechSynthesisUtterance:class{constructor(text){this.text=text}},Audio,localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},document:{getElementById:()=>null},setTimeout,clearTimeout});
 vm.runInContext(fs.readFileSync('practice.js','utf8'),ctx);
 vm.runInContext("const ALL=[{c:'狗',p:'gǒu'},{c:'子',p:'zǐ'},{c:'假',p:'jià / jiǎ'},{c:'满',p:'mǎn'}];",ctx);
 vm.runInContext("const REFERENCE_AUDIO={source:'CNS11643',readings:{gou3:'audio/cns-gou3.mp3',zi3:'audio/cns-zi3.mp3',jia4:'audio/cns-jia4.mp3',jia3:'audio/cns-jia3.mp3',man3:'audio/cns-man3.mp3'}};",ctx);
 if(mainland)vm.runInContext("const MAINLAND_AUDIO={source:'MSU Tone Perfect',readings:{gou3:'audio/msu-gou3.mp3',zi3:'audio/msu-zi3.mp3',jia4:'audio/msu-jia4.mp3',jia3:'audio/msu-jia3.mp3',man3:'audio/msu-man3.mp3'}};",ctx);
 vm.runInContext(fs.readFileSync('speech.js','utf8'),ctx);
 return {ctx,spoken,audio,voices,saved,events};
}
test('device Mandarin voice receives context for problem characters',()=>{
 const h=harness('mandarin');h.ctx.say('假');assert.equal(h.spoken[0].text,'假期的假');assert.equal(h.spoken[0].voice.lang,'zh-CN');
 h.ctx.say('子');assert.equal(h.spoken[1].text,'子，子女的子');assert.equal(h.ctx.mandarinVoices().length,1);
});
test('recorded audio is an explicit selectable option',()=>{
 const h=harness('recorded');h.ctx.say('狗');assert.equal(h.audio[0].url,'audio/%E7%8B%97.mp3');assert.equal(h.spoken.length,0);
});
test('late rejected playback cannot speak a previous question',async()=>{
 const h=harness('recorded');h.ctx.say('狗');h.ctx.stopSpeech();h.audio[0].onerror();await Promise.resolve();assert.equal(h.spoken.length,0);
});
test('browser default is attempted even when voice enumeration is empty',()=>{
 const h=harness();h.voices.length=0;h.ctx.say('狗');assert.equal(h.audio.length,0);assert.equal(h.spoken[0].lang,'zh-CN');assert.equal(h.spoken[0].voice,undefined);
});
test('navigation cancels queued instruction and character speech',async()=>{
 const h=harness();h.ctx.sayThen('en_listen','狗');h.ctx.stopSpeech();h.audio[0].onended();await Promise.resolve();assert.equal(h.spoken.length,0);
});

test('automatic Mandarin leaves voice selection to browser, not first listed voice',()=>{
 const h=harness();h.ctx.say('狗');assert.equal(h.spoken[0].voice,undefined);assert.equal(h.spoken[0].lang,'zh-CN');
});
test('exact duplicates collapse but same-name distinct voices stay selectable',()=>{
 const h=harness();h.voices.push({...h.voices[0]},{...h.voices[0],voiceURI:'mandarin-enhanced'});
 const voices=h.ctx.mandarinVoices();assert.equal(voices.length,2);
 assert.notEqual(h.ctx.voiceKey(voices[0]),h.ctx.voiceKey(voices[1]));
 assert.notEqual(h.ctx.voiceLabel(voices[0],voices),h.ctx.voiceLabel(voices[1],voices));
 h.saved.set('zh_voice',h.ctx.voiceKey(voices[1]));h.ctx.say('子');assert.equal(h.spoken[0].voice.voiceURI,'mandarin-enhanced');
});
test('Mandarin language variants include cmn and script tags without Cantonese',()=>{
 const h=harness();h.voices.push({name:'Lanlan',lang:'cmn_Hans_CN',voiceURI:'lanlan'},{name:'Other Mandarin',lang:'zh_Hans_CN',voiceURI:'hans'},{name:'Cantonese',lang:'yue-Hant-HK',voiceURI:'yue'});
 assert.equal(h.ctx.mandarinVoices().length,3);
});
test('legacy stored voice URI still selects the same voice',()=>{
 const h=harness('mandarin');h.ctx.say('狗');assert.equal(h.spoken[0].voice.voiceURI,'mandarin');
});
test('browser report shows unfiltered catalog, including excluded languages',()=>{
 const h=harness();const report=JSON.parse(h.ctx.voiceReport());
 assert.equal(report.voices.length,2);assert.equal(report.voices[1].lang,'zh-HK');assert.equal(report.voices[1].mandarin,false);
 assert.ok(h.ctx.voiceSettingsMarkup().includes('Google Cloud TTS'));
});

test('selected voice receives 满 without a voice-specific pronunciation substitution',()=>{
 const h=harness('mandarin');h.ctx.say('满');assert.equal(h.spoken[0].text,'满');assert.equal(h.spoken[0].voice.voiceURI,'mandarin');
});

// Reading-specific reference recordings must not inherit the character-only file bug.
test('new installations request Mainland Mandarin without changing saved progress',()=>{
 const h=harness(null);h.saved.set('zh_profiles','unchanged');h.ctx.say('狗');
 assert.equal(h.ctx.voicePreference(),'auto');assert.equal(h.spoken[0].lang,'zh-CN');assert.equal(h.audio.length,0);
 assert.equal(h.saved.get('zh_profiles'),'unchanged');assert.equal(h.saved.has('zh_voice'),false);
});
test('reference playback follows the primary expected reading and accepts an explicit listed alternative',()=>{
 const h=harness('reference');h.ctx.say('假');assert.equal(h.audio[0].url,'audio/cns-jia4.mp3');
 h.ctx.say('假','jiǎ');assert.equal(h.audio[1].url,'audio/cns-jia3.mp3');
 assert.equal(h.ctx.window.lastSpeechRequest.pinyin,'jiǎ');assert.equal(h.ctx.window.lastSpeechRequest.recording,'audio/cns-jia3.mp3');
});
test('reading keys retain ü and all five tones',()=>{
 const h=harness();assert.equal(h.ctx.recordingKey('lǜ'),'lv4');assert.equal(h.ctx.recordingKey('lù'),'lu4');
 assert.equal(h.ctx.recordingKey('nǚ'),'nv3');assert.equal(h.ctx.recordingKey('de'),'de5');assert.equal(h.ctx.recordingKey('mān'),'man1');
});
test('failed reference recording never substitutes a browser or old Google pronunciation',async()=>{
 const h=harness('reference');const pending=h.ctx.say('狗');h.audio[0].onerror();
 assert.equal(await pending,false);assert.equal(h.spoken.length,0);assert.equal(h.audio.length,1);
});
test('unlisted reading is rejected instead of guessing a clip',async()=>{
 const h=harness('reference');assert.equal(await h.ctx.say('假','jiā'),false);assert.equal(h.audio.length,0);assert.equal(h.spoken.length,0);
});
test('reference speech cancellation cannot advance instruction or question playback',async()=>{
 const h=harness('reference');const pending=h.ctx.sayThen('en_listen','狗');h.ctx.stopSpeech();h.audio[0].onended();
 await pending;assert.equal(h.audio.length,1);assert.equal(h.spoken.length,0);
});
test('voice settings describe reference recordings and retain explicit legacy choices',()=>{
 const h=harness('mandarin');assert.equal(h.ctx.voicePreference(),'mandarin');assert.match(h.ctx.voiceSettingsMarkup(),/CNS11643/);
});

test('Taiwan recordings are explicitly optional and saved selections are preserved',()=>{
 const h=harness('reference'),elements={
  'voice-choice':{value:'',innerHTML:''},'voice-note':{textContent:''}
 };
 h.ctx.document.getElementById=id=>elements[id]||null;h.ctx.refreshVoiceSettings();
 assert.match(elements['voice-choice'].innerHTML,/Mainland Mandarin · browser default/);
 assert.match(elements['voice-choice'].innerHTML,/Taiwan Mandarin recordings · optional/);
 assert.doesNotMatch(elements['voice-choice'].innerHTML,/recommended/);
 assert.match(elements['voice-note'].textContent,/not verified as Mainland/);
 assert.equal(elements['voice-choice'].value,'reference');assert.equal(h.saved.get('zh_voice'),'reference');
});

test('a dictionary word uses browser speech directly instead of requesting a nonexistent recording',async()=>{
 const h=harness('reference');const result=h.ctx.say('关于','guān yú');
 assert.equal(h.audio.length,0);assert.equal(h.spoken.length,1);assert.equal(h.spoken[0].text,'关于');assert.equal(h.spoken[0].lang,'zh-CN');
 assert.equal(h.ctx.window.lastSpeechRequest.character,'关于');assert.equal(h.ctx.window.lastSpeechRequest.pinyin,'guān yú');assert.equal(h.ctx.window.lastSpeechRequest.source,'browser speech');assert.equal(h.saved.get('zh_voice'),'reference');
 h.spoken[0].onend();assert.equal(await result,true);
});
test('failed dictionary-word speech reports failure without changing the saved voice or playing other audio',async()=>{
 const h=harness('reference'),status={textContent:'',hidden:true};h.ctx.document.getElementById=id=>id==='speech-status'?status:null;
 const result=h.ctx.say('关于');assert.equal(h.spoken.length,1);h.spoken[0].onerror();assert.equal(await result,false);assert.match(status.textContent,/Could not play/);assert.equal(status.hidden,false);assert.equal(h.audio.length,0);assert.equal(h.saved.get('zh_voice'),'reference');
});
test('unavailable browser speech for a dictionary word is explicit and never invents a recording URL',async()=>{
 const h=harness('reference'),status={textContent:'',hidden:true};delete h.ctx.window.speechSynthesis;h.ctx.document.getElementById=id=>id==='speech-status'?status:null;
 const pending=h.ctx.say('关于');if(h.audio[0])h.audio[0].onerror();assert.equal(await pending,false);assert.equal(h.audio.length,0);assert.match(status.textContent,/unavailable/i);assert.equal(h.saved.get('zh_voice'),'reference');
});

test('available Mainland recordings become the unset default without writing preferences or learner state',()=>{
 const h=harness(null,true);h.saved.set('zh_profiles','preserved');h.ctx.say('狗');
 assert.equal(h.ctx.voicePreference(),'mainland');assert.equal(h.audio[0].url,'audio/msu-gou3.mp3');
 assert.equal(h.spoken.length,0);assert.equal(h.saved.get('zh_profiles'),'preserved');assert.equal(h.saved.has('zh_voice'),false);
 for(const choice of ['auto','recorded','reference','mandarin'])assert.equal(harness(choice,true).ctx.voicePreference(),choice);
});

test('Mainland audio is reading-specific and never substitutes after a failed asset',async()=>{
 const h=harness('mainland',true);h.ctx.say('假','jiǎ');assert.equal(h.audio[0].url,'audio/msu-jia3.mp3');
 const pending=h.ctx.say('假','jià');h.audio[1].onerror();assert.equal(await pending,false);
 assert.equal(h.spoken.length,0);assert.equal(h.saved.get('zh_voice'),'mainland');
 assert.equal(await h.ctx.say('假','jiā'),false);assert.equal(h.audio.length,2);assert.equal(h.spoken.length,0);
});

test('Mainland coverage gaps use an explicitly identified device voice without inventing a file',async()=>{
 const h=harness('mainland',true),status={textContent:'',hidden:true};h.ctx.document.getElementById=id=>id==='speech-status'?status:null;
 vm.runInContext("ALL.push({c:'安',p:'ān'})",h.ctx);const pending=h.ctx.say('安');
 assert.equal(h.audio.length,0);assert.equal(h.spoken.length,1);assert.match(status.textContent,/device voice/i);
 assert.equal(h.ctx.window.lastSpeechRequest.source,'browser speech');assert.match(h.ctx.window.lastSpeechRequest.selectionNote,/not verified/i);
 h.spoken[0].onend();assert.equal(await pending,true);
});

test('known neutral gaps use existing Google audio explicitly unchecked, then identified device fallback',async()=>{
 const h=harness('mainland',true),status={textContent:'',hidden:true};h.ctx.document.getElementById=id=>id==='speech-status'?status:null;
 vm.runInContext("ALL.push({c:'吗',p:'ma'})",h.ctx);const pending=h.ctx.say('吗');
 assert.equal(h.audio[0]?.url,'audio/%E5%90%97.mp3');assert.match(status.textContent,/unchecked/i);
 assert.equal(h.ctx.window.lastSpeechRequest.source,'Google recording · unchecked');
 h.audio[0].onerror();await Promise.resolve();assert.equal(h.spoken.length,1);assert.match(status.textContent,/device voice.*unchecked/i);
 h.spoken[0].onend();assert.equal(await pending,true);
});

test('an uncovered alternate reading cannot fall back to the primary-reading context',async()=>{
 const h=harness('mainland',true);vm.runInContext('delete MAINLAND_AUDIO.readings.jia3',h.ctx);
 const pending=h.ctx.say('假','jiǎ');if(h.spoken[0])h.spoken[0].onend();
 assert.equal(await pending,false);assert.equal(h.audio.length,0);assert.equal(h.spoken.length,0);
});
