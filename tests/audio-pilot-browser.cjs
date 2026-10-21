const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createAudioPlan,reviewPage}=require('../scripts/audio-pilot.cjs');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'grove-audio-review-'));
 const plan=createAudioPlan({version:1,cases:[{id:'green',kind:'character',text:'绿',pinyin:'lǜ',meaning:'green',notes:'<img src=x onerror=alert(1)>'}]},['cmn-CN-Wavenet-A']);
 fs.writeFileSync(path.join(folder,'review.html'),reviewPage(plan));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:740}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.join(folder,'review.html'));assert.ok(await page.getByRole('combobox').isDisabled());assert.equal(await page.locator('img').count(),0,'Notes stay text, never HTML');
  plan.clips[0].sha256='audio-digest';fs.writeFileSync(path.join(folder,'review.html'),reviewPage(plan));await page.reload();
  await page.getByRole('combobox').selectOption('approved');await page.getByRole('textbox').fill('Checked intended reading and audio.');
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Download review'}).click();const download=await downloading;const destination=path.join(folder,'export.json');await download.saveAs(destination);const report=JSON.parse(fs.readFileSync(destination));assert.equal(report.judgements[plan.clips[0].id].status,'approved');assert.equal(report.judgements[plan.clips[0].id].sha256,'audio-digest');
  await page.reload();assert.equal(await page.getByRole('combobox').inputValue(),'approved');
  plan.clips[0].sha256='changed-audio';fs.writeFileSync(path.join(folder,'review.html'),reviewPage(plan));await page.reload();assert.equal(await page.getByRole('combobox').inputValue(),'pending','Changed audio invalidates prior approval');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/grove-audio-review-phone.png'});assert.deepEqual(errors,[]);
  console.log('PASS: local audio-review preview, disabled missing clips, human judgment persistence/export bound to audio digest, stale approval reset and safe text rendering.');
 }finally{await browser.close();fs.rmSync(folder,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exit(1)});
