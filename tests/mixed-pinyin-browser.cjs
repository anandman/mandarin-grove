const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.APP_URL||'http://127.0.0.1:4181');
 await page.evaluate(()=>{
  localStorage.setItem('zh_profiles',JSON.stringify({list:[{id:'pinyin',name:'Test',gr:'2',av:'🐳'}],cur:'pinyin'}));
  localStorage.setItem('zh_p_pinyin',JSON.stringify({stars:20,pts:{},box:{},due:{},cfg:{set:['狗','猫']}}));
 });await page.reload();
 for(const cram of [false,true]){
  await page.evaluate(cram=>{
   home();if(cram){showCram();selectCramUnits(true);startCram();}else startSession();
   const index=SESS.q.findIndex(([m])=>m==='dictation');
   if(index<0)throw Error('No dictation in generated queue');
   // Move that generated question to the front so reload and progression are deterministic.
   const [item]=SESS.q.splice(index,1);SESS.q.unshift(item);SESS.i=0;nextItem();
  },cram);
  const queue=await page.evaluate(()=>SESS.q.map(([m,c])=>[m,c.c]));
  if(cram){assert.equal(queue.length,30);assert.equal(queue.filter(([m])=>m==='dictation').length,6);}
  assert.ok(await page.locator('#dc').isVisible());
  const before=await page.evaluate(()=>({ch:DQ.q[0].c,p:skillState(S,DQ.q[0].c,'pinyin').attempts,w:skillState(S,DQ.q[0].c,'writing').attempts}));
  await page.reload();
  if(cram)await page.getByRole('button',{name:'Continue earlier unit review',exact:true}).click();else await page.evaluate(()=>resume());
  assert.ok(await page.locator('#dc').isVisible());
  assert.deepEqual(await page.evaluate(()=>SESS.q.map(([m,c])=>[m,c.c])),queue);
  // A blank pinyin answer is a miss; child self-rates writing as successful.
  await page.locator('#dchk').click();await page.locator('#cy').click();
  assert.equal(await page.evaluate(()=>SESS.i),2);
  const after=await page.evaluate(ch=>({p:skillState(S,ch,'pinyin'),w:skillState(S,ch,'writing'),standalone:S.cfg.cramDict}),before.ch);
  assert.equal(after.p.attempts,before.p+1);assert.equal(after.w.attempts,before.w+1);
  assert.ok(after.p.misses>=1);assert.ok(after.w.correct>=1);assert.equal(after.standalone,undefined);
  await page.reload();if(cram)await page.getByRole('button',{name:'Continue earlier unit review',exact:true}).click();else await page.evaluate(()=>resume());
  assert.equal(await page.evaluate(()=>SESS.i),2);
  await page.evaluate(()=>{SESS.i=SESS.q.length-1;SESS.q[SESS.i]=['dictation',ALL.find(c=>c.c==='狗')];nextItem()});
  for(const letter of 'gou')await page.locator(`[data-t="${letter}"]`).first().click();
  await page.locator('[data-tn="3"]').click();await page.locator('#dchk').click();await page.locator('#cy').click();
  assert.equal(await page.evaluate(()=>SESS),null);assert.match(await page.locator('#app').innerText(),/finished/);
  assert.equal(await page.evaluate(cram=>S.cfg[cram?'cram':'rs'],cram),undefined);
 }
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: daily and mixed-cram pinyin generation, cap/balance, reload before/after grading, separate skill records, final question completion.');
})().catch(e=>{console.error(e);process.exit(1)});
