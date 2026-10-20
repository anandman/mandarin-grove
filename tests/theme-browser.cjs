const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1180,height:900},colorScheme:'dark'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4173');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark','System is the default');
  assert.equal(await page.getByRole('button',{name:'Appearance',exact:true}).isVisible(),true,'Appearance is available before creating a child profile');
  await page.evaluate(()=>{PR={cur:'theme',list:[{id:'theme',name:'Learner',gr:'4',av:'🐳'}]};savePR();S=blank();S.stars=149;S.pts={祖:8,止:5};S.cfg.set=['祖','止','离','子'];S.cfg.cramUnits={'4':[1,3]};localStorage.setItem('zh_p_theme',JSON.stringify(S));loadS();home();});
  const progress=await page.evaluate(()=>localStorage.getItem('zh_p_theme'));
  const theme=async mode=>{await page.getByRole('button',{name:'Appearance',exact:true}).click();await page.getByRole('radio',{name:new RegExp('^'+mode)}).check();await page.getByRole('button',{name:'Close appearance',exact:true}).click();};
  await theme('Light');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.emulateMedia({colorScheme:'dark'});assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await theme('System');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await theme('Dark');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  assert.equal(await page.evaluate(()=>localStorage.getItem('zh_p_theme')),progress,'Appearance cannot alter profile progress');
  const bg=await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor);assert.notEqual(bg,'rgb(244, 241, 234)');
  await page.screenshot({path:'/tmp/mandarin-grove-home-dark.png',fullPage:false});
  await theme('Light');await page.screenshot({path:'/tmp/mandarin-grove-home-light.png',fullPage:false});
  // Theme changes preserve the active question, including drawings and pinyin tiles.
  await page.evaluate(()=>dictStart('祖'));
  await page.locator('[data-t="z"]').first().click();
  await page.locator('#dc').scrollIntoViewIfNeeded();const box=await page.locator('#dc').boundingBox();
  await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();await page.mouse.move(box.x+100,box.y+100,{steps:5});await page.mouse.up();
  const drawing=await page.locator('#dc').evaluate(canvas=>canvas.toDataURL());
  const pinyin=await page.locator('#pyout').textContent();await theme('Dark');
  assert.equal(await page.locator('#pyout').textContent(),pinyin);assert.equal(await page.locator('#dc').count(),1);
  assert.equal(await page.locator('#dc').evaluate(canvas=>canvas.toDataURL()),drawing,'Appearance must preserve a drawn answer');
  const contrast=await page.locator('#dclr').evaluate(el=>{
   const css=getComputedStyle(el),luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(n=>{const v=Number(n)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
   const a=luminance(css.color),b=luminance(css.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });assert.ok(contrast>=4.5,'Dark secondary actions must remain readable');
  await page.screenshot({path:'/tmp/mandarin-grove-dictation-dark.png',fullPage:true});
  await page.evaluate(async()=>{await new Promise(resolve=>SL('祖',resolve));detail(0,[ALL.find(c=>c.c==='祖')]);});
  assert.equal(await page.locator('#dhw').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 253, 245)','Stroke ink needs opaque paper in dark mode');
  await page.evaluate(()=>dclose());
  await page.evaluate(()=>home());await page.setViewportSize({width:390,height:844});
  for(const mode of ['Light','Dark']){
   await theme(mode);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:'/tmp/mandarin-grove-phone-'+mode.toLowerCase()+'.png',fullPage:false});
  }
  await page.evaluate(()=>grown());assert.equal(await page.locator('[data-appearance-setting]').inputValue(),'dark');
  await page.locator('[data-appearance-setting]').selectOption('system');await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  assert.deepEqual(errors,[]);console.log('PASS: System default, Light/Dark overrides, reload, OS changes, unchanged profile/active answer, settings and phone layouts.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
