const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 const failures=[];
 const run=async(name,test)=>{
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(4000);page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(process.env.APP_URL||'http://127.0.0.1:4194');
   await page.evaluate(()=>{PR={cur:'access-test',list:[{id:'access-test',name:'Synthetic',gr:'2',av:'🐼'}]};savePR();loadS();S=blank();S.stars=42;S.cfg.set=['狗','努','猫','牛','像'];S.opaque={keep:['original']};save();setCards();say=()=>{};home();kidProgress();});
   const before=await page.evaluate(()=>backup());await test(page);
   assert.equal(await page.evaluate(()=>backup()),before,'Navigation and accessibility actions preserve the entire backup');
   assert.deepEqual(errors,[]);console.log('PASS:',name);
  }catch(error){failures.push(name);console.error('FAIL:',name,error.message);}finally{await page.close();}
 };
 try{
  await run('unit keyboard toggling retains focus and allows the next Tab',async page=>{
   await page.locator('#progress-characters > summary').click();
   const unit=page.locator('#sets .set > button[aria-expanded]').first();
   await unit.press('Enter');
   assert.equal(await unit.evaluate(el=>el===document.activeElement),true,'Replacing the unit DOM must not send focus to BODY');
   await unit.press('Space');
   assert.equal(await unit.getAttribute('aria-expanded'),'true');
   await page.keyboard.press('Tab');
   assert.equal(await page.locator('#sets .character-tile').first().evaluate(el=>el===document.activeElement),true);
  });
  await run('Grade and Unit updates preserve keyboard focus, search and open browser',async page=>{
   await page.locator('#progress-characters > summary').click();await page.locator('#srch').fill('防');
   await page.locator('#dash-grade').focus();await page.locator('#dash-grade').selectOption('4');
   assert.equal(await page.locator('#dash-grade').evaluate(el=>el===document.activeElement),true);
   assert.equal(await page.locator('#progress-characters').evaluate(el=>el.open),true);
   assert.equal(await page.locator('#srch').inputValue(),'防');
   assert.equal(await page.locator('#sres button').count(),0,'Old-grade result is recomputed for new scope');
   await page.locator('#dash-unit').focus();await page.locator('#dash-unit').selectOption({label:'Unit 7'});
   assert.equal(await page.locator('#dash-unit').evaluate(el=>el===document.activeElement),true);
   assert.equal(await page.locator('#progress-characters').evaluate(el=>el.open),true);
   assert.equal(await page.locator('#srch').inputValue(),'防');
  });
  await run('voice-control names include visible labels and detail restores origin focus',async page=>{
   assert.equal(await page.getByRole('button',{name:/Synthetic.*2nd.*Switch/}).count(),1);
   assert.equal(await page.getByRole('button',{name:/0.*My badges/}).count(),1);
   assert.equal(await page.getByRole('button',{name:/0.*Your grove/}).count(),1);
   await page.locator('#progress-characters > summary').click();
   assert.equal(await page.getByRole('button',{name:/狗.*gǒu/}).count(),1);
   const tile=page.getByRole('button',{name:/狗.*gǒu/});await tile.press('Enter');await page.locator('#dov').waitFor();
   assert.equal(await page.getByRole('button',{name:/Hear pronunciation/}).count(),1);
   for(let i=0;i<7;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#dov')),true);}
   await page.keyboard.press('Escape');assert.equal(await tile.evaluate(el=>el===document.activeElement),true);
  });
  await run('Browse shortcut is in first viewport, filters precede metrics, weekly scope is honest',async page=>{
   const browse=page.getByRole('button',{name:'Browse characters',exact:true});
   const box=await browse.boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=844);
   assert.equal(await page.locator('.progress-filters').evaluate(el=>!!(el.compareDocumentPosition(document.getElementById('progress-next'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);
   assert.match(await page.locator('.progress-week').innerText(),/all grades/i);
   await browse.press('Enter');assert.equal(await page.locator('#progress-characters').evaluate(el=>el.open),true);
   assert.equal(await page.locator('#srch').evaluate(el=>el===document.activeElement),true);
  });
  await run('320px with text spacing keeps catalog metadata full width and controls operable',async page=>{
   await page.setViewportSize({width:320,height:844});await page.locator('#progress-characters > summary').click();
   await page.addStyleTag({content:'*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'});
   for(const theme of ['light','dark']){
    await page.evaluate(theme=>setAppearance(theme),theme);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal scroll at320 '+theme);
    const metadata=await page.locator('#sets > .gh').first().boundingBox(),grid=await page.locator('#sets').boundingBox();
    assert.ok(metadata.width>=grid.width-2,'Group heading spans the catalog grid');
    const button=await page.locator('#sets .set > button').first().boundingBox();assert.ok(button.height>=44);
   }
  });
  await run('search results follow dark appearance and repeat the selected unit scope',async page=>{
   await page.locator('#progress-characters > summary').click();await page.locator('#srch').fill('防');
   await page.evaluate(()=>setAppearance('dark'));
   const colors=await page.locator('#sres button').evaluate(el=>({bg:getComputedStyle(el).backgroundColor,fg:getComputedStyle(el).color}));
   const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);
   assert.ok(Math.max(...rgb(colors.bg))<100,'Dark mode search results must not use the old light widget background');
   await page.locator('#dash-unit').selectOption({label:'Unit 27'});
   assert.match(await page.locator('#progress-characters h2 + span').innerText(),/Unit 27/);
  });
 }finally{await browser.close();}
 assert.deepEqual(failures,[]);
})().catch(e=>{console.error(e);process.exit(1)});
