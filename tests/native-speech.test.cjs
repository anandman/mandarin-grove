const test=require('node:test'),assert=require('node:assert/strict');
let createSpeech;try{({createNativeSpeech:createSpeech}=require('../mobile/src/speech.ts'));}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
const tick=()=>new Promise(r=>setImmediate(r));
const zh={voiceURI:'local-zh',name:'Local Mandarin',lang:'zh-CN',localService:true,default:false},en={voiceURI:'local-en',name:'Local English',lang:'en-US',localService:true,default:true};
function fixture(options={}){let counter=0;const calls=[],pending=new Map(),plugin={async getVoices(){return {voices:[{...zh},{...en},{...zh,voiceURI:'network',localService:false},{...zh,voiceURI:'cantonese',lang:'zh-HK'}]};},speak(request){calls.push(request);return new Promise((resolve,reject)=>pending.set(request.id,{resolve,reject}));},async stop({id}){calls.push({stop:id});const p=pending.get(id);p?.resolve({id,spoken:false,reason:'cancelled'});}};assert.equal(typeof createSpeech,'function','Native speech has stable voice/request ownership and cancellable preparation');const speech=createSpeech(plugin,{makeId:()=>`synthetic-${++counter}`,...options});return {speech,plugin,calls,pending};}

test('chooses an installed local Mandarin voice by stable URI and waits for the native completion',async()=>{
 const a=fixture(),p=a.speech.speak({text:'合成测试',lang:'zh-CN',rate:0.75});await tick();assert.equal(a.calls.length,1);assert.equal(a.calls[0].voiceURI,'local-zh');assert.equal(a.speech.speaking,true);a.pending.get(a.calls[0].id).resolve({id:a.calls[0].id,spoken:true});assert.deepEqual(await p,{spoken:true});assert.equal(a.speech.speaking,false);
});
test('catalog reorder cannot redirect an explicit stable voice and saved preference input stays unchanged',async()=>{
 const a=fixture();a.plugin.getVoices=async()=>({voices:[{...en},{...zh}]});const request={text:'Synthetic prompt',lang:'en-US',voiceURI:'local-en'};const p=a.speech.speak(request);await tick();assert.equal(a.calls[0].voiceURI,'local-en');assert.deepEqual(request,{text:'Synthetic prompt',lang:'en-US',voiceURI:'local-en'});a.pending.get(a.calls[0].id).resolve({id:a.calls[0].id,spoken:true});await p;
});
test('missing, network-only and wrong-language requested voices never silently fall back',async()=>{
 for(const uri of ['missing','network','cantonese','local-en']){const a=fixture();assert.deepEqual(await a.speech.speak({text:'合成',lang:'zh-CN',voiceURI:uri}),{spoken:false,reason:'unavailable'});assert.equal(a.calls.length,0);}
 const a=fixture();a.plugin.getVoices=async()=>({voices:[]});assert.deepEqual(await a.speech.speak({text:'合成',lang:'zh-CN'}),{spoken:false,reason:'unavailable'});
});
test('cancel settles a pending utterance even when an engine never sends a completion callback',async()=>{
 const a=fixture();a.plugin.stop=async({id})=>{a.calls.push({stop:id});};const p=a.speech.speak({text:'合成',lang:'zh-CN'});await tick();await a.speech.cancel();assert.deepEqual(await p,{spoken:false,reason:'cancelled'});assert.equal(a.speech.speaking,false);
});
test('cancellation during catalog loading cannot replay after the list finally arrives',async()=>{
 const a=fixture();let release;a.plugin.getVoices=()=>new Promise(r=>release=r);const p=a.speech.speak({text:'合成',lang:'zh-CN'});await tick();await a.speech.cancel();release({voices:[zh]});assert.deepEqual(await p,{spoken:false,reason:'cancelled'});await tick();assert.equal(a.calls.length,0);
});
test('background cancels current/preparing speech and resume never automatically speaks old text',async()=>{
 const a=fixture(),p=a.speech.speak({text:'合成',lang:'zh-CN'});await tick();a.speech.setActive(false);assert.deepEqual(await p,{spoken:false,reason:'cancelled'});assert.deepEqual(await a.speech.speak({text:'合成',lang:'zh-CN'}),{spoken:false,reason:'background'});a.speech.setActive(true);await tick();assert.equal(a.calls.filter(x=>x.text).length,1);
});
test('a delayed old stop and old completion cannot stop or acknowledge the replacement utterance',async()=>{
 const a=fixture();let stopRelease;a.plugin.stop=({id})=>{a.calls.push({stop:id});return new Promise(r=>stopRelease=r);};const first=a.speech.speak({text:'合成一',lang:'zh-CN'});await tick();const old=a.calls[0];const second=a.speech.speak({text:'合成二',lang:'zh-CN'});await tick();assert.deepEqual(await first,{spoken:false,reason:'cancelled'});assert.equal(a.calls.filter(x=>x.text).length,1);stopRelease();await tick();const next=a.calls.find(x=>x.text==='合成二');assert.ok(next);a.pending.get(old.id).resolve({id:old.id,spoken:true});await tick();assert.equal(a.speech.speaking,true);a.pending.get(next.id).resolve({id:next.id,spoken:true});assert.deepEqual(await second,{spoken:true});
});
test('native errors or mismatched completion IDs cannot report successful speech',async()=>{
 for(const fail of ['error','wrong-id']){const a=fixture(),p=a.speech.speak({text:'合成',lang:'zh-CN'});await tick();const c=a.calls[0];if(fail==='error')a.pending.get(c.id).reject(Error('Synthetic engine error'));else a.pending.get(c.id).resolve({id:'other',spoken:true});assert.deepEqual(await p,{spoken:false,reason:'error'});}
});
test('oversized/invalid requests and an unavailable catalog remain bounded without native speech calls',async()=>{
 const a=fixture();for(const request of [{text:'',lang:'zh-CN'},{text:'x'.repeat(2001),lang:'zh-CN'},{text:'合成',lang:'not-a-language'}])assert.deepEqual(await a.speech.speak(request),{spoken:false,reason:'invalid'});assert.equal(a.calls.length,0);a.plugin.getVoices=async()=>{throw Error('Synthetic missing engine');};assert.deepEqual(await a.speech.speak({text:'合成',lang:'zh-CN'}),{spoken:false,reason:'unavailable'});
});

test('automatic Mainland selection recognizes cmn/script tags before a different-region default',async()=>{
 const a=fixture();a.plugin.getVoices=async()=>({voices:[{...zh,voiceURI:'taiwan',lang:'zh-TW',default:true},{...zh,voiceURI:'mainland-script',lang:'cmn_Hans_CN'}]});const p=a.speech.speak({text:'合成',lang:'zh-CN'});await tick();assert.equal(a.calls[0].voiceURI,'mainland-script');a.pending.get(a.calls[0].id).resolve({id:a.calls[0].id,spoken:true});await p;
});
test('a failed stop settles the old request but refuses to start a replacement before stopping succeeds',async()=>{
 const a=fixture(),first=a.speech.speak({text:'合成一',lang:'zh-CN'});await tick();a.plugin.stop=async()=>{throw Error('Synthetic engine cannot stop');};const replacement=a.speech.speak({text:'合成二',lang:'zh-CN'});assert.deepEqual(await first,{spoken:false,reason:'cancelled'});assert.deepEqual(await replacement,{spoken:false,reason:'error'});assert.equal(a.calls.filter(x=>x.text).length,1);
});
