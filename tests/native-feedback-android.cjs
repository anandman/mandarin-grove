// Actual synthetic AVD + native SQLite/UI, with compile-time guarded delivery mocks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{_android}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const sdk=process.env.ANDROID_HOME,serial=process.env.GROVE_ANDROID_SERIAL,output=process.env.GROVE_NATIVE_EVIDENCE,app='design.highgain.mandaringrove';assert.ok(sdk&&serial&&output);
const adb=(...args)=>execFileSync(path.join(sdk,'platform-tools/adb'),['-s',serial,...args],{encoding:'utf8'}).trim();
const scenario=fs.readFileSync('tests/fixtures/native-feedback-scenarios.js','utf8');
(async()=>{fs.mkdirSync(output,{recursive:false});let device,page;const receipt={platform:'android',syntheticOnly:true,passed:false};try{
 assert.match(adb('emu','avd','name'),/^Grove_API36_Play/);assert.equal(adb('shell','settings','get','global','airplane_mode_on'),'1');
 device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);assert.ok(device);
 async function attach(){adb('shell','am','start','-W','-n',app+'/.MainActivity');page=await(await device.webView({pkg:app})).page();page.setDefaultTimeout(15000);await page.evaluate(()=>GROVE_STARTED);await page.evaluate(scenario);}
 await attach();let pending;
 if(process.env.GROVE_PENDING_EVIDENCE){pending=JSON.parse(fs.readFileSync(process.env.GROVE_PENDING_EVIDENCE,'utf8'));receipt.recoveredPriorInterruptedRun=process.env.GROVE_PENDING_EVIDENCE;}
 else{
  receipt.refusedSave=await page.evaluate(()=>GroveFeedbackScenarios.refusedPendingSave());pending=await page.evaluate(()=>GroveFeedbackScenarios.beginPending());
  fs.writeFileSync(path.join(output,'pending.json'),JSON.stringify(pending,null,2)+'\n');
  const oldPID=adb('shell','pidof',app);adb('shell','am','force-stop',app);assert.throws(()=>adb('shell','pidof',app),'App process must be stopped');
  await device.close();device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);await attach();const newPID=adb('shell','pidof',app);assert.notEqual(oldPID,newPID);receipt.processDeath={oldPID,newPID};
 }
 fs.writeFileSync(path.join(output,'prior-backup.txt'),pending.prior);
 receipt.retry=await page.evaluate(state=>GroveFeedbackScenarios.recoverAndRetry(state),pending);fs.writeFileSync(path.join(output,'after-backup.txt'),await page.evaluate(()=>backup()));receipt.passed=true;console.log('PASS actual Android exact preview/cancel, SQLite FULL no network, offline pending then OS kill, same-ID explicit retry, raw unknowns and exact progress; delivery mocked');
 }finally{await device?.close();fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');}})().catch(e=>{console.error(e);process.exitCode=1;});
