const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1180,height:820}}),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4173');
  await page.evaluate(()=>{
   PR={cur:'writer-a',list:[{id:'writer-a',name:'Learner A',gr:'4',av:'🐳'},{id:'writer-b',name:'Learner B',gr:'2',av:'🐼'}]};savePR();
   S=blank();S.stars=149;S.pts={狗:6};S.cfg.quiz=QU()[0][1];S.cfg.cramUnits={'4':[1,3]};
   recordSkill(S,'祖','listen','correct');recordSkill(S,'祖','pinyin','assisted');
   localStorage.setItem('zh_p_writer-a',JSON.stringify(S));loadS();home();
  });
  const storage=()=>page.evaluate(()=>JSON.stringify({...localStorage}));
  const before=await storage();
  await page.getByRole('button',{name:'Help',exact:true}).click();await page.getByRole('button',{name:/Writing ideas/}).click();
  assert.equal(await page.locator('.writing-heading svg').count(),1);
  await page.locator('#writing-input').fill('學校');await page.locator('#writing-input').press('Enter');
  assert.equal(await page.locator('.writing-word span').first().textContent(),'学校');
  const first=await page.locator('.writing-prompt').textContent();
  await page.locator('#writing-another').focus();await page.keyboard.press('Enter');
  assert.notEqual(await page.locator('.writing-prompt').textContent(),first);
  assert.equal(await page.locator('#writing-another').evaluate(e=>e===document.activeElement),true);
  // Enter used to confirm an IME candidate must not request a prompt.
  await page.locator('#writing-input').fill('雨');
  await page.locator('#writing-input').dispatchEvent('compositionstart');await page.locator('#writing-input').press('Enter');
  assert.equal(await page.locator('.writing-seed').count(),0);
  await page.locator('#writing-input').dispatchEvent('compositionend');
  await page.locator('#writing-input').dispatchEvent('keydown',{key:'Enter',isComposing:true});
  assert.equal(await page.locator('.writing-seed').count(),0);
  await page.locator('#writing-input').press('Enter');assert.equal(await page.locator('.writing-seed').count(),1);
  await page.locator('#writing-input').fill('雨学校');assert.equal(await page.locator('.writing-seed').count(),0);
  await page.locator('#writing-generate').click();assert.match(await page.locator('#writing-status').textContent(),/not have/);
  await page.locator('#writing-input').fill('school');await page.locator('#writing-input').press('Enter');
  assert.match(await page.locator('#writing-status').textContent(),/Chinese character/);assert.equal(await page.locator('#writing-finish').count(),0);
  await page.locator('#writing-browse summary').click();await page.locator('#writing-browse-search').fill('school');
  await page.getByRole('button',{name:'Use 学校 school',exact:true}).focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('.writing-word span').first().textContent(),'学校');
  assert.equal(await storage(),before,'Requesting and browsing ideas must not write profile progress or rewards');
  // Feedback records the idea, without a child's name or unrelated speech details.
  await page.getByRole('button',{name:'Report a problem',exact:true}).click();
  const report=JSON.parse((await page.locator('#feedback-output').inputValue()).split('\n\n')[1]);
  assert.equal(report.writing.word,'学校');assert.equal(report.speech,null);assert.ok(!JSON.stringify(report).includes('Learner A'));
  await page.getByRole('button',{name:'Close feedback',exact:true}).click();
  const evidence=await page.evaluate(()=>JSON.stringify({learning:S.learning,rewards:S.rewards,cfg:S.cfg,stars:S.stars,pts:S.pts}));
  const balance=await page.evaluate(()=>groveWallet(S).balance);
  await page.locator('#writing-finish').dblclick();await page.locator('#writing-confirm').click();
  assert.equal(await page.evaluate(()=>groveWallet(S).balance),balance+1);
  assert.equal(await page.evaluate(()=>groveWallet(S).writingSentences),1);
  assert.equal(await page.locator('#writing-finish').isDisabled(),true);
  assert.equal(await page.evaluate(()=>JSON.stringify({learning:S.learning,rewards:S.rewards,cfg:S.cfg,stars:S.stars,pts:S.pts})),evidence);
  await page.getByRole('button',{name:'Back to Help',exact:true}).click();await page.getByRole('button',{name:'Back to Home',exact:true}).click();
  await page.getByRole('button',{name:'Help',exact:true}).click();await page.getByRole('button',{name:/Writing ideas/}).click();
  assert.equal(await page.locator('#writing-finish').isDisabled(),true,'Reopening must not let the same idea earn twice');
  await page.locator('#writing-another').click();assert.equal(await page.locator('#writing-finish').isDisabled(),false);
  await page.locator('#writing-finish').click();await page.locator('#writing-confirm').click();assert.equal(await page.evaluate(()=>groveWallet(S).balance),balance+2);
  await page.getByRole('button',{name:/Your grove/}).click();await page.getByRole('tab',{name:'Stamps',exact:true}).click();assert.match(await page.getByRole('tabpanel',{name:'Stamps',exact:true}).innerText(),/2 sentences celebrated/);
  await page.reload();await page.evaluate(()=>home());
  assert.equal(await page.evaluate(()=>groveWallet(S).writingSentences),2);assert.equal(await page.evaluate(()=>groveWallet(S).balance),balance+2);
  await page.evaluate(()=>{const data=JSON.parse(decodeURIComponent(escape(atob(backup()))));if(JSON.parse(data.data['writer-a']).groveRewards.writingSentences!==2)throw Error('Sentence rewards missing from backup');});
  await page.getByRole('button',{name:'Help',exact:true}).click();await page.getByRole('button',{name:/Writing ideas/}).click();await page.locator('#writing-input').fill('雨');await page.locator('#writing-generate').click();
  await page.screenshot({path:'/tmp/mandarin-grove-writing-ipad.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('#writing-input').evaluate(e=>e.getBoundingClientRect().width>200),true);
  await page.screenshot({path:'/tmp/mandarin-grove-writing-phone.png',fullPage:true});
  // Switching children cannot reveal the previous child's typed input or rewards.
  await page.evaluate(()=>{PR.cur='writer-b';savePR();loadS();home();});
  await page.getByRole('button',{name:'Help',exact:true}).click();await page.getByRole('button',{name:/Writing ideas/}).click();
  assert.equal(await page.locator('#writing-input').inputValue(),'');assert.equal(await page.locator('.writing-seed').count(),0);
  assert.equal(await page.evaluate(()=>groveWallet(S).balance),0);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  console.log('PASS: local ideas, exact compounds, IME, varied decks, keyboard browse, unchanged learning, private feedback, one orange per sentence, reload/backup, child isolation and mobile layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
