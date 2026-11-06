// Real isolated web app/repository. Narrow file service doubles verify UI routing;
// actual OS document-picker tests are a separate required native gate.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:820,height:1060},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(window,'GrovePersistence',{configurable:true,set(value){Object.defineProperty(window,'GrovePersistence',{value:{...value,createRepository(options){const repo=value.createRepository(options);return Object.freeze({...repo,importBackup(code,...rest){window.nativeCapturedImport=code;return repo.importBackup(code,...rest);}});}},writable:true,configurable:true});}}));
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4263');
  const fixture=JSON.parse(fs.readFileSync('tests/fixtures/backups/original-v1.json','utf8'));
  const code='\ufeff\n'+Buffer.from(JSON.stringify(fixture)).toString('base64')+'\r\n';
  await page.evaluate(async({fixture,code})=>{
   await GROVE_STARTED;await GROVE_REPOSITORY.importBackup(GROVE_CODEC.encodeUtf8(JSON.stringify(fixture)));PR=await GROVE_REPOSITORY.readRegistry();await loadS({persist:false});await home();
   window.nativeInput=code;window.nativeFileCalls=[];window.GrovePlatform={...GrovePlatform,platform:'android',files:{saveText(options){nativeFileCalls.push(options);return new Promise((resolve,reject)=>{window.releaseNativeSave=resolve;window.rejectNativeSave=reject;});},async openText(){return window.cancelNativeOpen?{cancelled:true}:{cancelled:false,text:window.nativeInput};}}};await grown('backup');
  },{fixture,code});
  const before=await page.evaluate(()=>backup());await page.getByRole('button',{name:'Download backup file',exact:true}).click();
  await page.waitForFunction(()=>typeof releaseNativeSave==='function');assert.equal(await page.evaluate(()=>nativeFileCalls[0].text),before);
  assert.doesNotMatch(await page.locator('#backup-status').innerText(),/saved|prepared/i,'No completion before OS acknowledgement');
  await page.evaluate(()=>releaseNativeSave({saved:false}));await page.waitForFunction(()=>document.getElementById('backup-status').textContent.includes('cancel'));
  await page.getByRole('button',{name:'Download backup file',exact:true}).click();await page.waitForFunction(()=>nativeFileCalls.length===2);await page.evaluate(()=>releaseNativeSave({saved:true}));await page.waitForFunction(()=>document.getElementById('backup-status').textContent.includes('saved'));
  await page.evaluate(()=>document.getElementById('backup-status').textContent='');await page.getByRole('button',{name:'Download backup file',exact:true}).click();await page.waitForFunction(()=>nativeFileCalls.length===3);await page.evaluate(()=>rejectNativeSave(Object.assign(Error('Synthetic temporary copy removal refused after file saved'),{code:'GROVE_EXPORT_SAVED'})));await page.waitForFunction(()=>document.getElementById('backup-status').textContent.includes('copy'));assert.match(await page.locator('#backup-status').innerText(),/^Backup file saved\./);assert.doesNotMatch(await page.locator('#backup-status').innerText(),/Could not prepare/);assert.equal(await page.evaluate(()=>backup()),before);
  await page.evaluate(()=>window.cancelNativeOpen=true);await page.getByRole('button',{name:'Restore from backup file',exact:true}).click();assert.equal(await page.locator('#grr').count(),0);assert.equal(await page.evaluate(()=>backup()),before);
  await page.evaluate(()=>window.cancelNativeOpen=false);await page.getByRole('button',{name:'Restore from backup file',exact:true}).click();await page.locator('#grr').waitFor();assert.equal(await page.evaluate(()=>backup()),before,'Native file open only previews');
  await page.locator('#grr').click();await page.waitForFunction(()=>!document.getElementById('grr'));assert.equal(await page.evaluate(()=>nativeCapturedImport),code,'Exact BOM, whitespace and original code reach durable native import');
  await page.evaluate(()=>{GrovePlatform.exportRecovery=async()=>({format:'synthetic-raw-native-recovery',files:[{name:'mandarin_groveSQLite.db',base64:'cHJlc2VydmU='}]});showProgressRecovery(Error('Unsupported future schema'));});
  await page.getByRole('button',{name:'Download recovery copy',exact:true}).click();await page.waitForFunction(()=>nativeFileCalls.length===4);assert.equal(JSON.parse(await page.evaluate(()=>nativeFileCalls[3].text)).format,'synthetic-raw-native-recovery');assert.doesNotMatch(await page.locator('#recovery-file-status').innerText(),/saved/i);await page.evaluate(()=>releaseNativeSave({saved:true}));await page.waitForFunction(()=>document.getElementById('recovery-file-status').textContent.includes('saved'));
  await page.evaluate(()=>document.getElementById('recovery-file-status').textContent='');await page.getByRole('button',{name:'Download recovery copy',exact:true}).click();await page.waitForFunction(()=>nativeFileCalls.length===5);await page.evaluate(()=>rejectNativeSave(Object.assign(Error('Synthetic temporary copy removal refused after recovery saved'),{code:'GROVE_EXPORT_SAVED'})));await page.waitForFunction(()=>document.getElementById('recovery-file-status').textContent.includes('copy'));assert.match(await page.locator('#recovery-file-status').innerText(),/^Recovery file saved\./);assert.doesNotMatch(await page.locator('#recovery-file-status').innerText(),/Could not export/);
  assert.deepEqual(errors,[]);console.log('PASS native backup UI awaits OS acknowledgement, reports saved files despite cleanup errors, preserves exact input and exports recovery independently of repository readiness');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
