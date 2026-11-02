// Dedicated synthetic emulator only; real packaged APK, OS airplane mode and WebView.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {_android}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const sdk=process.env.ANDROID_HOME,serial=process.env.GROVE_ANDROID_SERIAL,output=process.env.GROVE_NATIVE_EVIDENCE;
assert.ok(sdk&&serial&&output,'Set SDK, dedicated serial and ignored evidence directory');
const adb=(...args)=>execFileSync(path.join(sdk,'platform-tools/adb'),['-s',serial,...args],{encoding:'utf8'}).trim();
const app='io.github.anandman.mandaringrove';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 fs.mkdirSync(output,{recursive:true});const receipt={platform:'android',serial,package:app,syntheticOnly:true,checks:[],scope:'L1 engineering shell only; durable saves/sync/family beta unimplemented'};let browser;
 try{
  adb('shell','cmd','connectivity','airplane-mode','enable');adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');assert.equal(adb('shell','settings','get','global','airplane_mode_on'),'1');
  adb('shell','am','force-stop',app);adb('shell','am','start','-W','-n',app+'/.MainActivity');
  browser=(await _android.devices({omitDriverInstall:true})).find(device=>device.serial()===serial);
  assert.ok(browser,'The dedicated emulator must be available through Playwright Android');
  const webView=await browser.webView({pkg:app});const page=await webView.page();
  await page.waitForFunction(()=>document.getElementById('native-status')?.textContent.startsWith('Packaged content ready'));
  assert.equal(await page.evaluate(()=>GrovePlatform.platform),'android');assert.equal(await page.evaluate(()=>GrovePlatform.persistenceReady),false);
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);assert.equal(await page.evaluate(()=>typeof window.GROVE_REPOSITORY),'undefined');assert.equal(await page.evaluate(()=>typeof window.chkVer),'undefined');receipt.checks.push('cold packaged boot in actual OS airplane mode; no learner repository or web updater');
  assert.equal(await page.evaluate(async()=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),3000);try{await fetch('https://example.com/',{signal:c.signal});return false;}catch{return true;}finally{clearTimeout(t)}}),true,'External network must be unavailable');receipt.checks.push('external network request fails');
  await page.locator('#native-dictionary').click();await page.waitForFunction(()=>document.getElementById('native-definition').textContent.includes('学校'));assert.ok(await page.locator('#native-strokes svg path').count());receipt.checks.push('actual packaged dictionary and stroke data render offline');
  await page.locator('#native-audio').click();await page.waitForFunction(()=>document.getElementById('native-status').textContent==='Bundled fǔ recording finished.',{},{timeout:15000});receipt.checks.push('exact packaged fǔ audio plays to native ended event offline');
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);fs.writeFileSync(path.join(output,'android-airplane-smoke.png'),execFileSync(path.join(sdk,'platform-tools/adb'),['-s',serial,'exec-out','screencap','-p']));
  receipt.passed=true;console.log('PASS Android actual packaged airplane-mode boot/dictionary/strokes/audio, no unsafe saves or web updater');
 }finally{
  if(browser)await browser.close();fs.writeFileSync(path.join(output,'android-shell-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 }
})().catch(error=>{console.error(error);process.exitCode=1});
