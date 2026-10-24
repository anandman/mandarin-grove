const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1180,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4173');
  await page.evaluate(()=>{PR={cur:'expanded',list:[{id:'expanded',name:'Learner',gr:'K',av:'🐳'},{id:'other',name:'Other',gr:'4',av:'🐼'}]};savePR();S=blank();S.cfg.set=['一','二'];S.pts={一:5,二:5};S.stars=149;localStorage.setItem('zh_p_expanded',JSON.stringify(S));loadS();home();});
  assert.equal(await page.getByRole('button',{name:'Practice',exact:true}).count(),1,'Home keeps the shared Practice entry');
  await page.evaluate(()=>{for(const char of ['一','二'])for(let i=0;i<2;i++)recordSkill(S,char,'listen','correct');save();home()});
  assert.equal(await page.evaluate(()=>unitReadiness(S,SET(),GR()).ready),true);
  assert.deepEqual(await page.evaluate(()=>[...SET()]),['一','二'],'Readiness never silently adds units');
  await page.evaluate(()=>showGroveUnitChooser());
  await page.getByRole('button',{name:'Add Unit 3',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>[...SET()]),['一','二','三','十']);
  await page.reload();assert.deepEqual(await page.evaluate(()=>[...SET()]),['一','二','三','十']);
  // Even actual spaced mastery must leave the school unit selection alone.
  await page.evaluate(()=>{const start=Date.now()-4*REVIEW_DAY;for(const char of ['三','十'])for(const skill of ['listen','memory']){let time=start;for(let i=0;i<3;i++){recordSkill(S,char,skill,'correct',time);time=skillState(S,char,skill).due;}}save();home()});
  assert.deepEqual(await page.evaluate(()=>[...SET()]),['一','二','三','十']);
  await page.evaluate(()=>showGroveUnitChooser());
  await page.getByRole('button',{name:'Add Unit 7',exact:true}).click();
  assert.ok(await page.evaluate(()=>[...QU('K').find(([n])=>n===7)[1]].every(c=>SET().includes(c))),'School units can be added out of order');
  await page.evaluate(()=>showGroveRewards());
  assert.equal(await page.evaluate(()=>GROVE_REWARD_CATALOG.length),20);await page.getByRole('tab',{name:'Build',exact:true}).click();
  assert.equal(await page.locator('[data-project]').count(),2);
  const startingBalance=await page.evaluate(()=>groveWallet(S).balance);
  await page.getByRole('tab',{name:'Ground',exact:true}).click();
  await page.locator('[data-reward="flowers"]').getByRole('button',{name:'Unlock · 🍊 1',exact:true}).focus();
  await page.keyboard.press('Enter');
  await page.evaluate(()=>new Promise(requestAnimationFrame));
  assert.equal(await page.evaluate(()=>document.activeElement.closest('[data-reward]')?.dataset.reward),'flowers','Keyboard purchases keep focus on the replacement control');
  await page.getByRole('tab',{name:'Trees',exact:true}).click();await page.locator('[data-reward="violet-leaves"]').getByRole('button',{name:'Unlock · 🍊 3',exact:true}).click();
  const balance=await page.evaluate(()=>groveWallet(S).balance);assert.equal(balance,startingBalance-4);
  assert.ok(await page.locator('#grove-action-notice').isVisible(),'Purchases need a readable notice rather than the oversized celebration overlay');
  assert.ok(await page.locator('#grove-action-notice').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)<=20));
  assert.equal(await page.locator('.grove-reward-scene [data-scene="flowers"]').count(),1);
  assert.equal(await page.locator('.grove-reward-scene [data-scene="violet-leaves"]').count(),1);
  await page.getByRole('tab',{name:'Build',exact:true}).click();await page.locator('[data-project="reading-nook"]').getByRole('button',{name:'Make this my goal',exact:true}).click();
  assert.match(await page.locator('.grove-goal').innerText(),/Woven mat/);
  await page.locator('[data-project="reading-nook"]').getByRole('button',{name:'Build Woven mat · 🍊 2',exact:true}).click();
  assert.match(await page.locator('.grove-goal').innerText(),/Bookshelf/);
  assert.equal(await page.locator('.grove-reward-scene [data-project-scene="reading-nook"] [data-piece]').count(),1);
  await page.locator('[data-project="reading-nook"]').getByRole('button',{name:'Build Bookshelf · 🍊 3',exact:true}).click();
  assert.equal(await page.locator('.grove-reward-scene [data-project-scene="reading-nook"] [data-piece]').count(),2);
  await page.locator('#grove-undo').click();assert.equal(await page.evaluate(()=>groveWallet(S).balance),balance-2);
  await page.getByRole('tab',{name:'Visitors',exact:true}).click();await page.getByRole('button',{name:'Invite Cat, Friend 2',exact:true}).click();
  assert.equal(await page.evaluate(()=>groveEquipped(S).visitors),'zoo:1');
  await page.getByRole('button',{name:'Back home',exact:true}).click();
  assert.equal(await page.locator('.grove-hero-art [data-scene="flowers"]').count(),1);
  assert.equal(await page.locator('.grove-hero-art [data-scene="zoo:1"]').count(),1);
  assert.match(await page.locator('.grove-goal').innerText(),/Bookshelf/);
  await page.reload();await page.evaluate(()=>showGroveRewards());
  assert.equal(await page.evaluate(()=>groveWallet(S).balance),balance-2);
  assert.equal(await page.evaluate(()=>groveWallet(S).projects['reading-nook'].stage),1);
  assert.equal(await page.evaluate(()=>groveEquipped(S).visitors),'zoo:1');
  const snapshot=await page.evaluate(()=>{const code=JSON.parse(decodeURIComponent(escape(atob(backup()))));return JSON.parse(code.data.expanded).groveRewards;});
  assert.equal(snapshot.equipped.ground,'flowers');assert.equal(snapshot.goal,'project:reading-nook');assert.equal(snapshot.projects['reading-nook'].stage,1);
  const exported=await page.evaluate(()=>backup());
  await page.evaluate(()=>{S.groveRewards.balance=0;S.groveRewards.equipped={};save();grown()});
  await page.locator('#grest').click();await page.locator('#grt').fill(exported);await page.locator('#grr').click();
  assert.deepEqual(await page.evaluate(()=>groveWallet(S)),snapshot,'The actual restore controls retain the new wallet fields and do not re-credit earnings');
  await page.evaluate(()=>showGroveRewards());
  await page.getByRole('tab',{name:'Build',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.pop')&&(document.querySelector('#grove-action-notice')?.hidden??true));
  for(const mode of ['light','dark']){
   await page.evaluate(mode=>setAppearance(mode),mode);
   await page.locator('.grove-reward-workbench').screenshot({path:'/tmp/grove-workbench-'+mode+'.png'});
   await page.locator('.grove-projects').screenshot({path:'/tmp/grove-projects-'+mode+'.png'});
   await page.screenshot({path:'/tmp/grove-expanded-'+mode+'.png',fullPage:true});
   await page.setViewportSize({width:390,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('.grove-reward-workbench').screenshot({path:'/tmp/grove-workbench-phone-'+mode+'.png'});
   await page.screenshot({path:'/tmp/grove-expanded-phone-'+mode+'.png',fullPage:true});
   await page.setViewportSize({width:1180,height:900});
  }
  await page.evaluate(()=>{PR.cur='other';savePR();loadS();showGroveRewards()});
  assert.equal(await page.evaluate(()=>groveWallet(S).balance),0);assert.equal(await page.evaluate(()=>Object.keys(groveEquipped(S)).length),0);
  assert.equal(await page.locator('.grove-goal').count(),0);
  for(const grade of ['1','2','4','5']){
   const before=await page.evaluate(grade=>{
    PR.list.find(p=>p.id===PR.cur).gr=grade;savePR();S=blank();S.cfg.set=[...QU(grade)[0][1]];S.cfg.quiz=QU(grade)[0][1];S.cfg.test='2099-10-20';
    for(const char of SET())for(let i=0;i<2;i++)for(const skill of ['listen','memory',...(Number(grade)>=2&&characterNeedsPinyin(char)?['pinyin']:[])])recordSkill(S,char,skill,'correct');
    save();setCards();home();return {set:[...SET()],quiz:S.cfg.quiz,test:S.cfg.test};
   },grade);
   assert.equal(await page.evaluate(()=>unitReadiness(S,SET(),GR()).ready),true);
   assert.deepEqual(await page.evaluate(()=>[...SET()]),before.set);
   await page.evaluate(()=>showGroveUnitChooser());
   await page.getByRole('button',{name:'Add Unit 7',exact:true}).click();
   const after=await page.evaluate(()=>({set:[...SET()],quiz:S.cfg.quiz,test:S.cfg.test}));
   assert.equal(after.quiz,before.quiz);assert.equal(after.test,before.test);assert.ok(before.set.every(c=>after.set.includes(c)));
  }
  await page.evaluate(()=>{groveWallet(S).balance=100;save();showGroveRewards()});await page.getByRole('tab',{name:'Build',exact:true}).click();
  for(const [piece,cost]of [['Ladder',3],['Platform',3],['Window walls',4],['Treehouse roof',4]]){
   await page.locator('[data-project="treehouse"]').getByRole('button',{name:`Build ${piece} · 🍊 ${cost}`,exact:true}).click();
  }
  assert.equal(await page.locator('.grove-reward-scene [data-project-scene="treehouse"] [data-piece]').count(),4);
  assert.match(await page.locator('[data-project="treehouse"]').innerText(),/Built by you/);
  await page.locator('[data-project="treehouse"]').getByRole('button',{name:'Put away for now',exact:true}).click();
  assert.equal(await page.locator('.grove-reward-scene [data-project-scene="treehouse"]').count(),0);
  await page.locator('[data-project="treehouse"]').getByRole('button',{name:'Show in my grove',exact:true}).click();
  assert.equal(await page.evaluate(()=>groveWallet(S).projects.treehouse.stage),4);
  await page.locator('.grove-arrange>summary').click();await page.getByRole('button',{name:'Use the original grove',exact:true}).click();
  assert.equal(await page.evaluate(()=>groveWallet(S).projects.treehouse.stage),4,'Putting a project away never deletes it');
  assert.equal(await page.evaluate(()=>groveWallet(S).projects.treehouse.visible),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: optional same-day unit readiness, arbitrary units and no mastery auto-advance; 20 cosmetics, combinable slots, project pieces/refunds, free zoo visitors, goal persistence, backup/profile isolation and both themes/mobile.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
