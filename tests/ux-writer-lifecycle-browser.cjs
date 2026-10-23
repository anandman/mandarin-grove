const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});try{
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.APP_URL||'http://127.0.0.1:4194');
const lifecycle=await page.evaluate(async()=>{
 const data=await fetch('strokes/十.json').then(r=>r.json());
 const mount=()=>{const box=document.createElement('div');box.style.cssText='width:300px;height:300px';document.body.append(box);return box;};
 const options=done=>({charDataLoader:(_,complete)=>{done(complete);},showCharacter:false});
 // Detach while actual HanziWriter data is pending, then allow the real quiz continuation to settle.
 const detached=mount();let finishDetached;const old=WritingSurface.create(detached,'十',options(done=>finishDetached=done));
 const pendingOld=old.quiz();detached.remove();await Promise.resolve();finishDetached(data);await pendingOld;
 const detachedActive=!!old._quiz;
 // A new guide can replace a pending one on the same connected element.
 const shared=mount();let finishFirst,finishSecond;
 const first=WritingSurface.create(shared,'十',options(done=>finishFirst=done));const pendingFirst=first.quiz();
 const second=WritingSurface.create(shared,'十',options(done=>finishSecond=done));const pendingSecond=second.quiz();
 finishFirst(data);finishSecond(data);await Promise.all([pendingFirst,pendingSecond]);
 const replacedActive=!!first._quiz,currentActive=!!second._quiz;shared.remove();await Promise.resolve();
 // Detachment in the same turn as data delivery must also suppress a queued start.
 const sameTurn=mount();let finishSame;const third=WritingSurface.create(sameTurn,'十',options(done=>finishSame=done));const pendingThird=third.quiz();
 finishSame(data);sameTurn.remove();await pendingThird;
 return {detachedActive,replacedActive,currentActive,sameTurnActive:!!third._quiz,currentDisposed:!second._quiz};
});
assert.equal(lifecycle.detachedActive,false,'A detached pending guide cannot leave a background quiz running');
assert.equal(lifecycle.replacedActive,false,'A replaced pending guide cannot start on the new target');
assert.equal(lifecycle.currentActive,true,'The current connected guide still starts normally');
assert.equal(lifecycle.sameTurnActive,false,'Same-turn detach and data delivery cannot start a discarded quiz');
assert.equal(lifecycle.currentDisposed,true,'An already active detached quiz is cancelled');
const pendingAnimation=await page.evaluate(async()=>{
 const data=await fetch('strokes/十.json').then(r=>r.json()),results={};
 for(const kind of ['native','shared']){
  const box=document.createElement('div');box.style.cssText='width:300px;height:300px';document.body.append(box);let finish;
  const options={charDataLoader:(_,done)=>{finish=done;},showCharacter:false,delayBetweenStrokes:0,strokeAnimationSpeed:100,strokeFadeDuration:0};
  const w=kind==='native'?HanziWriter.create(box,'十',options):WritingSurface.create(box,'十',options);
  const quiz=w.quiz();w.cancelQuiz();const animation=w.animateCharacter();finish(data);const [,result]=await Promise.all([quiz,animation]);
  results[kind]=result.canceled;w.cancelQuiz();box.remove();
 }
 return results;
});
assert.equal(pendingAnimation.native,false,'Native Watch strokes cancels a pending quiz');
assert.equal(pendingAnimation.shared,false,'Shared cleanup preserves Watch strokes ordering while data is pending');
const palettes=await page.evaluate(async()=>{
 const data=await fetch('strokes/林.json').then(r=>r.json());const box=document.createElement('div');box.style.cssText='width:300px;height:300px';document.body.append(box);setAppearance('light');
 const guide=WritingSurface.create(box,'林',{charDataLoader:(_,done)=>done(data)});await guide.getCharacterData();
 const paths=()=>[...box.querySelectorAll('path[stroke]')].slice(data.strokes.length,data.strokes.length*2).map(p=>p.getAttribute('stroke'));
 const results=[];for(const mode of ['dark','light']){setAppearance(mode);await new Promise(r=>setTimeout(r,30));results.push(paths());}box.remove();return results;
});
for(const paths of palettes){assert.equal(paths.length,8);assert.equal(new Set(paths).size,1,'Every main radical stroke follows the same current ink');}
await page.evaluate(async()=>{const box=document.createElement('div');box.style.cssText='width:300px;height:300px';document.body.append(box);const w=WritingSurface.create(box,'十',{charDataLoader:(_,done,fail)=>fail(Error('Synthetic guide failure')),onLoadCharDataError:()=>{}});await w.getCharacterData();setAppearance('dark');await new Promise(r=>setTimeout(r,30));box.remove();});assert.deepEqual(errors,[],'Failed guides cannot break later theme updates');
console.log('PASS: detached/replaced/same-turn delayed quizzes are cleaned up, connected quiz works, radical paths follow themes and failed guides stay isolated.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
