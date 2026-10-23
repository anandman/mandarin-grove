const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
 const page=await b.newPage({viewport:{width:1180,height:820}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.APP_URL||'http://127.0.0.1:4173');
 await page.evaluate(()=>{PR={cur:'grove',list:[{id:'grove',name:'Learner',gr:'4',av:'🐳'}]};savePR();S=blank();S.stars=149;S.streak=1;S.last=today();S.cfg.quiz=QU()[0][1];for(let i=0;i<120;i++)recordSkill(S,'祖','trace','assisted');localStorage.setItem('zh_p_grove',JSON.stringify(S));loadS();home()});
 assert.equal(await page.evaluate(()=>groveWallet(S).balance),14);
 assert.equal(await page.locator('.study-home-entries > button').count(),2);assert.equal(await page.getByRole('button',{name:'Practice',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Review',exact:true}).count(),1);
 await page.getByRole('button',{name:'My progress',exact:true}).click();await page.locator('#progress-characters > summary').click();
 assert.ok(await page.locator('#sets').evaluate(e=>e.classList.contains('grove-trees')));
 await page.locator('#grove-view-list').click();assert.equal(await page.locator('#sets').evaluate(e=>e.classList.contains('grove-trees')),false);
 await page.reload();await page.evaluate(()=>home());await page.getByRole('button',{name:'My progress',exact:true}).click();await page.locator('#progress-characters > summary').click();assert.equal(await page.locator('#grove-view-list').getAttribute('aria-pressed'),'true');
 await page.locator('#grove-view-trees').click();
 // Unit character tiles must work with keyboard activation in both layouts.
 await page.evaluate(()=>new Promise(resolve=>SL('祖',resolve)));
 for(const view of ['list','trees']){
  await page.locator('#grove-view-'+view).click();
  for(const key of ['Enter','Space']){
   await page.getByRole('button',{name:/祖.*zǔ/}).focus();
   await page.keyboard.press(key);
   assert.equal(await page.locator('#dov').count(),1,'Character tile must activate with '+key+' in '+view+' view');
   await page.evaluate(()=>dclose());
  }
 }
 await page.getByRole('button',{name:/^Unit 7 /}).click();assert.ok(await page.getByRole('button',{name:'▶ Practice this unit',exact:true}).count()>0);
 await page.screenshot({path:'/tmp/mandarin-grove-trees-ipad.png',fullPage:true});
 await page.getByRole('button',{name:/Your grove/}).click();
 await page.getByRole('tab',{name:'Trees',exact:true}).click();
 await page.locator('[data-reward="violet-leaves"]').getByRole('button',{name:'Unlock · 🍊 3',exact:true}).click();
 assert.equal(await page.evaluate(()=>groveWallet(S).balance),11);assert.equal(await page.evaluate(()=>S.stars),149);
 await page.reload();await page.evaluate(()=>showGroveRewards());assert.equal(await page.evaluate(()=>groveWallet(S).balance),11);
 await page.locator('#grove-undo').click();assert.equal(await page.evaluate(()=>groveWallet(S).balance),14);
 await page.getByRole('tab',{name:'Visitors',exact:true}).click();await page.locator('[data-reward="butterfly"]').getByRole('button',{name:'Unlock · 🍊 4',exact:true}).click();await page.getByRole('button',{name:'Back home',exact:true}).click();await page.getByRole('button',{name:'My progress',exact:true}).click();await page.locator('#progress-characters > summary').click();assert.ok(await page.locator('.grove-visitor').isVisible());
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/mandarin-grove-trees-phone.png',fullPage:true});
 await page.getByRole('button',{name:/Your grove/}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/mandarin-grove-fruit.png',fullPage:true});
 await page.evaluate(()=>{const data=JSON.parse(decodeURIComponent(escape(atob(backup()))));if(!JSON.parse(data.data.grove).groveRewards)throw Error('Rewards missing from backup')});
 assert.deepEqual(errors,[]);console.log('PASS: tree/list persistence, arbitrary unit access, retroactive fruit once, unlock/reload/refund, decoration, legacy stars, backup and mobile layout.');
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exit(1)});
