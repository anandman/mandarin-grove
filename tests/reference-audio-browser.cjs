// Exercise actual HTML audio and published bytes, using an isolated synthetic child.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');const crypto=require('node:crypto');
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 try{
 const page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.APP_URL||'http://127.0.0.1:4181');
 await page.evaluate(()=>{
  localStorage.setItem('zh_profiles',JSON.stringify({list:[{id:'audio-test',name:'Audio test',av:'🐳',gr:'4'}],cur:'audio-test'}));
  localStorage.setItem('zh_p_audio-test',JSON.stringify({stars:149,streak:1,last:'',pts:{'假':3,'子':4},box:{'假':2},due:{'假':99999},cfg:{set:['假','女','绿','路','努','狗'],cramUnits:{'4':[1,3]}}}));
 });await page.reload();
 const before=await page.evaluate(()=>localStorage.getItem('zh_p_audio-test'));
 assert.equal(await page.evaluate(()=>voicePreference()),await page.evaluate(()=>expectsMainlandRecordings()?'mainland':'auto'));
 await page.evaluate(()=>localStorage.setItem('zh_voice','reference'));
 const assets=new Set();
 for(const [character,pinyin] of [['止','zhǐ'],['离','lí'],['狗','gǒu'],['满','mǎn'],['假','jià'],['假','jiǎ'],['女','nǚ'],['努','nǔ'],['绿','lǜ'],['路','lù'],['的','de']]){
  assert.equal(await page.evaluate(([c,p])=>say(c,p),[character,pinyin]),true,character+' '+pinyin+' playback');
  const request=await page.evaluate(()=>window.lastSpeechRequest);
  assert.equal(request.pinyin,pinyin);assert.equal(request.source,'CNS11643 reference recording');
  assert.match(request.recording,/^audio\/cns-/);assets.add(request.recording);
  const response=await page.request.get(new URL(request.recording,page.url()).href);
  assert.equal(response.status(),200);assert.equal(crypto.createHash('sha256').update(await response.body()).digest('hex'),crypto.createHash('sha256').update(fs.readFileSync(request.recording)).digest('hex'));
 }
 assert.equal(assets.size,11,'distinct intended readings receive distinct files');
 assert.equal(await page.evaluate(()=>localStorage.getItem('zh_p_audio-test')),before,'speech preserves progress');
 await page.evaluate(()=>grown());
 assert.equal(await page.locator('#voice-choice').inputValue(),'reference');
 assert.match(await page.locator('#voice-note').innerText(),/CNS11643/);
 await page.screenshot({path:'/tmp/grove-reference-voice-phone.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#voice-choice').selectOption('auto');await page.reload();
 assert.equal(await page.evaluate(()=>voicePreference()),'auto','explicit browser preference survives');
 await page.evaluate(()=>{localStorage.setItem('zh_voice','reference');window.browserFallbacks=0;const original=speechSynthesis.speak.bind(speechSynthesis);speechSynthesis.speak=u=>{window.browserFallbacks++;original(u)}});
 const blocked=await page.evaluate(()=>REFERENCE_AUDIO.readings.gou3);
 await page.route('**/'+blocked,route=>route.abort());
 assert.equal(await page.evaluate(()=>say('狗')),false);
 assert.equal(await page.evaluate(()=>window.browserFallbacks),0);
 assert.match(await page.locator('#speech-status').innerText(),/could not play/);
 assert.deepEqual(errors,[]);
 console.log('PASS: 11 real reading-specific audio playbacks and byte checks; polyphones, ü/u repairs, neutral WAV, preference and progress preservation, visible failure without speech substitution.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
