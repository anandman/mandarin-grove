// Shared speech implementation, real sequence logic, narrow native service double.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const tick=()=>new Promise(r=>setImmediate(r));
async function harness(preference='auto'){
 const calls=[],audio=[],events={},saved=new Map([['zh_voice',preference]]),status={textContent:'',hidden:true};
 const speech={active:true,voices:[{voiceURI:'local-zh',name:'Local Mandarin',lang:'zh-CN',localService:true}],async cancel(){calls.push({cancel:true});},speak(request){calls.push(request);return new Promise(r=>speech.complete=r);},async refresh(){return true;}};
 class Audio{constructor(url){this.url=url;this.paused=true;this.ended=false;audio.push(this);}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;this.onpause?.();}removeAttribute(){}load(){}}
 const platform={platform:'android',speech},window={GrovePlatform:platform,addEventListener(name,fn){events[name]=fn;}};
 const document={hidden:false,getElementById:id=>id==='speech-status'?status:null,querySelectorAll:()=>[],addEventListener(name,fn){events[name]=fn;}};
 const ctx=vm.createContext({window,GrovePlatform:platform,document,GROVE_REPOSITORY:{readPreference:async k=>saved.get(k)??null,writePreference:async(k,v)=>saved.set(k,v)},Audio,setTimeout,clearTimeout});
 vm.runInContext(fs.readFileSync('practice.js','utf8'),ctx);vm.runInContext("const ALL=[{c:'狗',p:'gǒu'},{c:'子',p:'zǐ'}];const MAINLAND_AUDIO={source:'MSU',acceptanceBasis:'native-source-review',readings:{gou3:'audio/msu-gou3.mp3',zi3:'audio/msu-zi3.mp3'}};",ctx);vm.runInContext(fs.readFileSync('speech.js','utf8'),ctx);await vm.runInContext('VOICE_READY',ctx);return{ctx,speech,calls,audio,events,saved,status,document};
}
test('native fallback works without browser speech and preserves the saved voice preference',async()=>{
 const h=await harness(),p=h.ctx.say('你好');await tick();assert.equal(h.calls.find(x=>x.text)?.text,'你好');assert.match(h.ctx.window.lastSpeechRequest.source,/native|device/);h.speech.complete({spoken:true});assert.equal(await p,true);assert.equal(h.saved.get('zh_voice'),'auto');
});
test('default selected MSU playback stays byte/path directed and never invokes synthesis',async()=>{
 const h=await harness('mainland'),p=h.ctx.say('狗');await tick();assert.equal(h.audio[0].url,'audio/msu-gou3.mp3');assert.equal(h.calls.some(x=>x.text),false);h.audio[0].ended=true;h.audio[0].onended();assert.equal(await p,true);
});
test('background invalidates and settles the recording sequence; late end cannot speak the next sample',async()=>{
 const h=await harness('mainland'),p=h.ctx.sayThen('狗','子');await tick();const first=h.audio[0];h.document.hidden=true;h.speech.active=false;h.events.visibilitychange();first.ended=true;first.onended();await p;await tick();assert.equal(h.audio.length,1);assert.equal(vm.runInContext('activeAudio===null&&speechFinish===null',h.ctx),true);assert.equal(h.calls.some(x=>x.text),false);
});
test('a missing native Mandarin voice reports availability honestly instead of claiming playback',async()=>{
 const h=await harness(),p=h.ctx.say('你好');await tick();assert.equal(typeof h.speech.complete,'function');h.speech.complete({spoken:false,reason:'unavailable'});assert.equal(await p,false);assert.match(h.status.textContent,/installed|available|Settings|settings/);assert.doesNotMatch(h.status.textContent,/browser voice/);assert.equal(h.saved.get('zh_voice'),'auto');
});

test('native catalog keeps an existing encoded voice choice by stable identity when presentation changes',async()=>{
 const preference='voice:'+encodeURIComponent(JSON.stringify(['local-zh','zh-CN','Earlier presentation',false])),h=await harness(preference);assert.equal(h.ctx.selectedMandarinVoice()?.voiceURI,'local-zh');assert.equal(h.saved.get('zh_voice'),preference);
});
