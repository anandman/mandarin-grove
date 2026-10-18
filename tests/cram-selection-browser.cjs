const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');
 await page.evaluate(()=>{
  localStorage.setItem('zh_profiles',JSON.stringify({list:[{id:'a',name:'A',gr:'4'},{id:'b',name:'B',gr:'4'}],cur:'a'}));
  localStorage.setItem('zh_p_a',JSON.stringify({stars:10,pts:{},box:{},due:{},cfg:{set:['查','狗','猫']}}));
 });await page.reload();await page.evaluate(()=>showCram());
 await page.locator('[data-unit="2"]').check();await page.locator('[data-unit="6"]').check();
 const added=await page.locator('[data-unit^="2:"]').first().getAttribute('data-unit');
 await page.locator(`[data-unit="${added}"]`).check();
 const selected=()=>page.locator('[data-unit]:checked').evaluateAll(xs=>xs.map(x=>x.dataset.unit).sort());
 const expected=await selected();assert.equal(expected.length,3);
 await page.reload();await page.evaluate(()=>showCram());assert.deepEqual(await selected(),expected);
 await page.evaluate(()=>{PR.cur='b';loadS();showCram()});assert.deepEqual(await selected(),[]);
 await page.locator('[data-unit="1"]').check();
 await page.evaluate(()=>{PR.cur='a';loadS();showCram()});assert.deepEqual(await selected(),expected);
 await page.evaluate(()=>{PR.list[0].gr='3';showCram()});assert.deepEqual(await selected(),[]);
 await page.locator('[data-unit="1"]').check();
 await page.evaluate(()=>{PR.list[0].gr='4';showCram()});assert.deepEqual(await selected(),expected);
 await page.evaluate(()=>selectCramUnits(false));await page.reload();await page.evaluate(()=>showCram());assert.deepEqual(await selected(),[]);
 await page.evaluate(()=>selectCramUnits(true));const all=await selected();
 await page.reload();await page.evaluate(()=>showCram());assert.deepEqual(await selected(),all);
 await page.evaluate(()=>{S.cfg.set=['查'];setCards();showCram()});assert.ok(!(await selected()).includes(added));
 assert.equal(await page.evaluate(()=>S.stars),10);assert.deepEqual(errors,[]);
 await browser.close();console.log('PASS: selections persist before starting; cross-grade, child/grade isolation, Clear/All and stale selection pruning.');
})().catch(e=>{console.error(e);process.exit(1)});
