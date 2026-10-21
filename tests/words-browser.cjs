const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:740}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4181');
  const baseline=await page.evaluate(()=>{PR={cur:'words',list:[{id:'words',name:'Learner',gr:'4',av:'🐳'},{id:'other',name:'Friend',gr:'2',av:'🐼'}]};savePR();S=blank();S.stars=149;S.pts={祖:5,止:5};S.cfg.set=['学','狗','组','绿'];localStorage.setItem('zh_p_words',JSON.stringify(S));loadS();save();window.say=()=>{};home();return JSON.stringify(S);});
  assert.equal(requests.filter(r=>r.url.includes('/cc-cedict/words.json')).length,0,'Word bank is lazy-loaded');
  await page.getByRole('button',{name:/Word practice.*组词/}).click();await page.locator('#word-check').waitFor();await page.waitForFunction(()=>!document.getElementById('word-check').disabled);
  await page.locator('#word-character').selectOption('学');
  await page.locator('#word-input').fill('学校');await page.locator('#word-input').dispatchEvent('compositionstart');await page.locator('#word-input').press('Enter');
  assert.equal(await page.evaluate(()=>S.wordPractice?.words?.学?.length||0),0,'IME Enter must not prematurely grade');
  await page.locator('#word-input').dispatchEvent('compositionend');await page.locator('#word-check').click();
  assert.match(await page.locator('#word-result').innerText(),/xué xiào/);assert.match(await page.locator('#word-count').innerText(),/1 word/);
  await page.locator('#word-input').fill('學生');await page.locator('#word-check').click();assert.match(await page.locator('#word-count').innerText(),/2 words/);
  for(const [value,pattern]of [['学校',/already collected/],['学甲乙丙',/Not in our word bank yet/],['學甲乙丙',/Not in our word bank yet/],['小狗',/Use 学/],['<img>',/at least two Chinese/]]){await page.locator('#word-input').fill(value);await page.locator('#word-check').click();assert.match(await page.locator('#word-status').innerText(),pattern);}
  assert.equal(await page.evaluate(()=>document.querySelector('#word-result img')!==null),false);
  const after=await page.evaluate(()=>{const copy=JSON.parse(JSON.stringify(S));delete copy.wordPractice;return JSON.stringify(copy);});assert.equal(after,baseline,'Only vocabulary collection is added; progress, SRS, selection, rewards stay exact');
  const saved=await page.evaluate(()=>{const b=JSON.parse(decodeURIComponent(escape(atob(backup()))));return JSON.parse(b.data.words).wordPractice.words.学;});assert.deepEqual(saved,['学校','学生'],'Word collection is included in normal backups');
  await page.reload();await page.evaluate(()=>{window.say=()=>{};home()});await page.getByRole('button',{name:/Word practice.*组词/}).click();await page.waitForFunction(()=>!document.getElementById('word-check').disabled);await page.locator('#word-character').selectOption('学');assert.match(await page.locator('#word-count').innerText(),/2 words/);
  await page.getByRole('button',{name:'Choose other units'}).click();assert.ok(await page.getByRole('heading',{name:'Word practice units',exact:true}).isVisible());
  await page.getByRole('button',{name:'Clear',exact:true}).click();assert.ok(await page.getByRole('button',{name:/Start word practice/}).isDisabled());
  await page.locator('[data-unit="2"]').check();await page.locator('[data-unit="11"]').check();const added=page.locator('[data-unit^="2:"]').first();if(await added.count())await added.check();
  const expected=await page.evaluate(()=>selectedCramCards().map(c=>c.c).sort());assert.ok(expected.length>10);
  await page.getByRole('button',{name:/Start word practice/}).click();assert.deepEqual(await page.evaluate(()=>WORD_SESSION.pool.map(c=>c.c).sort()),expected);
  for(const [device,width,height]of [['phone',390,740],['ipad',820,1060],['desktop',1180,740]])for(const mode of ['light','dark']){await page.setViewportSize({width,height});await page.evaluate(mode=>{setAppearance(mode);showWordPractice([ALL.find(c=>c.c==='学')])},mode);await page.waitForFunction(()=>!document.getElementById('word-check').disabled);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const button=await page.locator('#word-check').boundingBox();assert.ok(button.height>=44&&button.y+button.height<=height,'Check word fits the first screen on '+device);await page.screenshot({path:`/tmp/grove-words-${device}-${mode}.png`});}
  await page.evaluate(()=>{PR.cur='other';savePR();loadS();showWordPractice([ALL.find(c=>c.c==='学')]);});await page.waitForFunction(()=>!document.getElementById('word-check').disabled);assert.match(await page.locator('#word-count').innerText(),/0 words/);assert.equal(await page.evaluate(()=>S.wordPractice===undefined),true);
  const retry=await browser.newPage();await retry.route('**/vendor/cc-cedict/words.json*',r=>r.abort());await retry.goto(process.env.APP_URL||'http://127.0.0.1:4181');await retry.evaluate(()=>{PR={cur:'retry',list:[{id:'retry',name:'Learner',gr:'2',av:'🐼'}]};savePR();S=blank();loadS();showWordPractice([ALL.find(c=>c.c==='学')]);});await retry.getByRole('button',{name:'Try loading again'}).waitFor({state:'visible'});assert.ok(await retry.locator('#word-check').isDisabled());await retry.unroute('**/vendor/cc-cedict/words.json*');await retry.getByRole('button',{name:'Try loading again'}).click();await retry.waitForFunction(()=>!document.getElementById('word-check').disabled);await retry.close();
  assert.ok(requests.every(r=>r.method==='GET'),'Typed answers are never posted to a server');assert.deepEqual(errors,[]);
  console.log('PASS: local 组词, traditional forms, IME, unknown/duplicate guidance, exact progress preservation, backup/reload, arbitrary cross-grade units, profile isolation, loading retry and responsive light/dark layouts.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
