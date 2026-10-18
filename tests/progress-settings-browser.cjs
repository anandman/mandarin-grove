const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');
 await page.evaluate(()=>{localStorage.setItem('zh_profiles',JSON.stringify({cur:'test',list:[{id:'test',name:'Older',gr:'4',av:'🐳'},{id:'younger',name:'Younger',gr:'1',av:'🐻'}]}));localStorage.setItem('zh_p_test',JSON.stringify({stars:10,streak:0,last:'',pts:{},box:{},due:{},cfg:{}}));});
 await page.reload();await page.evaluate(()=>home());
 await page.getByRole('button',{name:'My progress ›',exact:true}).click();
 assert.ok(await page.getByRole('heading',{name:'My progress',exact:true}).isVisible());assert.equal(await page.locator('#dash-child').count(),0);
 await page.locator('#dash-grade').selectOption('2');await page.locator('#dash-unit').selectOption({index:1});
 assert.ok(await page.getByRole('heading',{name:'My progress',exact:true}).isVisible());assert.equal(await page.locator('#dash-child').count(),0);
 assert.equal(await page.evaluate(()=>PR.cur),'test');assert.equal(await page.evaluate(()=>GR()),'4');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/hanzi-kid-progress.png'});
 for(const grade of ['K','1','2','3','4','5']){
  await page.evaluate(g=>{PR.list[0].gr=g;home()},grade);
  assert.equal(await page.getByRole('button',{name:'My progress ›',exact:true}).count(),Number(grade)>=3?1:0);
 }
 await page.evaluate(()=>{PR.list[0].gr='4';savePR();home();grown()});await page.getByRole('button',{name:'Parent dashboard',exact:true}).click();assert.ok(await page.locator('#dash-child').isVisible());
 // Open stale tab before selection; its routine saves must preserve the fresh choice.
 const stale=await ctx.newPage();await stale.goto('http://127.0.0.1:4173');
 await page.evaluate(()=>showCram());await page.locator('[data-unit="2"]').check();
 await stale.evaluate(()=>{S.stars++;save()});await page.reload();await page.evaluate(()=>showCram());assert.ok(await page.locator('[data-unit="2"]').isChecked());
 // A stale picker must reload the latest selection; clearing remains deliberate and persistent.
 await stale.evaluate(()=>showCram());assert.ok(await stale.locator('[data-unit="2"]').isChecked());
 await page.evaluate(()=>selectCramUnits(false));await stale.evaluate(()=>{S.stars++;save()});await page.reload();await page.evaluate(()=>showCram());assert.equal(await page.locator('[data-unit]:checked').count(),0);
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: kid dashboard grade gate, read-only child scope, parent access, mobile layout, stale-tab saves, picker reload and intentional Clear.');
})().catch(e=>{console.error(e);process.exit(1)});
