const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.APP_URL||'http://127.0.0.1:4181');
 await page.evaluate(()=>{
  localStorage.setItem('zh_profiles',JSON.stringify({list:[{id:'test4',name:'Test student',av:'🐳',gr:'4'}],cur:'test4'}));
  localStorage.setItem('zh_p_test4',JSON.stringify({stars:149,streak:1,last:'',pts:{'假':3,'子':4},box:{'假':2},due:{'假':99999},cfg:{set:['查','族','裔','行','本','确','办','祖','正'],quiz:'游假旁停谈访止判程',rs:{q:[['listen','查']],i:0,t:'Saved daily session',p:['查']}}}));
 });await page.reload();
 await page.evaluate(()=>showCram());
 await page.locator('[data-unit="2"]').check();await page.locator('[data-unit="6"]').check();await page.locator('[data-unit="11"]').check();
 assert.match(await page.locator('#cram-count').innerText(),/3 units \/ sets · 27 characters · 30 activities/);
 await page.screenshot({path:'/tmp/hanzi-cram-desktop.png',fullPage:true});
 await page.locator('[data-cram-mode="mixed"]').click();
 assert.equal(await page.evaluate(()=>SESS.q.length),30);
 for(const mode of ['listen','trace','flip','memory']) {
  await page.evaluate(mode=>{SESS.i=SESS.q.findIndex(x=>x[0]===mode);nextItem()},mode);
  const visible=mode==='listen'?'.choices':mode==='flip'?'#cd':'#hw';
  assert.ok(await page.locator(visible).isVisible());
 }
 await page.evaluate(()=>{SESS.i=SESS.q.length;nextItem()});
 await page.getByRole('button',{name:'Practice again',exact:true}).click();
 assert.equal(await page.evaluate(()=>SESS.q.length),30);
 await page.evaluate(()=>showCram());
 for(const mode of ['trace','listen','flip','memory','dictation']){
  await page.getByText('Review in just one mode',{exact:true}).click();
  await page.locator(`[data-cram-mode="${mode}"]`).click();
  assert.equal(await page.evaluate(()=>CRAM.pool.length),27);
  if(mode==='dictation'){
   assert.equal(await page.evaluate(()=>DQ.q.length),27);
   await page.evaluate(()=>{DQ.q=[ALL.find(c=>c.c==='假')];DQ.i=0;dictItem()});
   for(const t of ['j','i','a'])await page.locator(`[data-t="${t}"]`).first().click();
   await page.getByRole('button',{name:'Tone 3',exact:true}).click();
   await page.locator('#dchk').click();assert.match(await page.locator('#app').innerText(),/jiǎ ✅/);
   await page.locator('#cy').click();await page.getByRole('button',{name:'Choose units / mode'}).click();
  }else if(mode==='flip'){
   await page.locator('#cd').click();await page.locator('#yes').click();
   await page.evaluate(()=>{SESS.i=SESS.q.length;nextItem()});
   await page.getByRole('button',{name:'Choose units / mode'}).click();
  }else await page.evaluate(()=>showCram());
 }
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('zh_p_test4')));
 assert.deepEqual(state.cfg.set,['查','族','裔','行','本','确','办','祖','正']);
 assert.equal(state.cfg.rs.t,'Saved daily session');assert.equal(state.due['假'],99999);assert.ok(state.stars>=149);assert.ok(state.pts['子']>=4);
 // Home now exposes the shared Review setup; all PDF units remain selectable.
 await page.evaluate(()=>home());await page.getByRole('button',{name:'Review',exact:true}).click();assert.equal(await page.locator('[data-study-unit^="4:"]').count(),13);await page.getByRole('button',{name:'Close session choices',exact:true}).click();
 await page.evaluate(()=>{home();grown()});assert.ok(await page.locator('#voice-choice').isVisible());await page.locator('#voice-choice').selectOption('recorded');assert.equal(await page.evaluate(()=>localStorage.getItem('zh_voice')),'recorded');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>showCram());
 await page.waitForTimeout(1100);await page.screenshot({path:'/tmp/hanzi-cram-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.evaluate(()=>{home();showCram();selectCramUnits(true)});
 assert.equal(await page.locator('[data-unit]:checked').count(),13);
 await page.evaluate(()=>selectCramUnits(false));assert.ok(await page.locator('[data-cram-mode="mixed"]').isDisabled());
 await page.evaluate(()=>{PR.list[0].gr='2';savePR();S.cfg.quiz='卖买常进出';S.cfg.past=[{q:'努狗牛猫像',d:'2026-10-01'}];save()});
 await page.reload();
 assert.equal(await page.evaluate(()=>S.cfg.quiz),'买卖进常出');
 assert.equal(await page.evaluate(()=>S.cfg.past[0].q),'狗努猫牛像');
 await page.evaluate(()=>{CRAM=null;dictStart('女')});
 await page.locator('[data-t="n"]').click();await page.locator('[data-t="v"]').click();await page.getByRole('button',{name:'Tone 3',exact:true}).click();await page.locator('#dchk').click();
 assert.match(await page.locator('#app').innerText(),/nǚ ✅/);
 await page.screenshot({path:'/tmp/hanzi-pinyin-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.evaluate(()=>{PR.list[0].gr='4';S.cfg.set=['查','狗','猫','买','卖'];S.pts['努']=3;setCards();home();kidProgress();document.getElementById('progress-characters').open=true;});
 assert.ok(await page.getByRole('heading',{name:'4th grade · PDF units',exact:true}).isVisible());
 await page.locator('#dash-grade').selectOption('2');await page.locator('#progress-characters').evaluate(el=>el.open=true);
 assert.ok(await page.getByRole('heading',{name:'2nd grade · PDF units',exact:true}).isVisible());
 const tile=page.locator('#sets [aria-label="努, 3 of 5 stars"]');
 assert.equal(await tile.locator('.dots i.on').count(),3);
 assert.equal(await page.evaluate(()=>HS.filter(h=>h.g==='2').length),27);
 assert.deepEqual(await page.evaluate(()=>SET()),['查','狗','猫','买','卖'],'Shared browsing filters preserve the cross-grade practice selection');
 await page.screenshot({path:'/tmp/hanzi-home-units-mobile.png',fullPage:true});
 const selectionBefore=await page.evaluate(()=>JSON.stringify({...S.cfg,cram:undefined,cramDict:undefined,cramUnits:undefined}));
 await page.evaluate(()=>{showCram();selectCramUnits(false)});
 assert.ok(await page.getByRole('heading',{name:'2nd grade · Added units',exact:true}).isVisible());
 await page.getByRole('checkbox',{name:'4th grade · Unit 1',exact:true}).check();
 await page.getByRole('checkbox',{name:'2nd grade · Unit 1',exact:true}).check();
 assert.match(await page.locator('#cram-count').innerText(),/2 units \/ sets · 14 characters · 30 activities/);
 await page.screenshot({path:'/tmp/hanzi-crossgrade-cram-mobile.png',fullPage:true});
 await page.locator('[data-cram-mode="mixed"]').click();
 assert.equal(await page.evaluate(()=>SESS.q.length),30);
 assert.equal(await page.evaluate(()=>new Set(SESS.pool.map(c=>c.c)).size),14);
 assert.equal(await page.evaluate(()=>JSON.stringify({...S.cfg,cram:undefined,cramDict:undefined,cramUnits:undefined})),selectionBefore);
 await page.evaluate(()=>{SESS.i=SESS.q.length;nextItem()});
 await page.getByRole('button',{name:'Practice again',exact:true}).click();
 assert.equal(await page.evaluate(()=>SESS.q.length),30);
 await page.evaluate(()=>{S.cfg.set=['查'];setCards();showCram()});
 assert.equal(await page.getByRole('checkbox',{name:'2nd grade · Unit 1',exact:true}).count(),0);
 assert.match(await page.locator('#cram-count').innerText(),/1 units \/ sets · 9 characters · 30 activities/);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('PASS: five cram modes, arbitrary units, jiǎ grading, progress/daily-session preservation, unit quizzes, voice setting, mobile width; no page errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
