// Recover a real exported synthetic save into a new Android user/app sandbox.
// Keep the new user and all prior data; never uninstall, clear or delete a user.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {_android}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.GROVE_NATIVE_EVIDENCE,source=process.env.GROVE_RECOVERY_SOURCE;
const sdk=process.env.ANDROID_HOME,serial=process.env.GROVE_ANDROID_SERIAL;
assert.ok(output&&source&&sdk&&serial,'Explicit dedicated emulator, source receipt and new evidence directory required');
const app='design.highgain.mandaringrove',executable=path.join(sdk,'platform-tools/adb');
const adb=(...args)=>execFileSync(executable,['-s',serial,...args],{encoding:'utf8',timeout:90000}).trim();
const decode=code=>JSON.parse(Buffer.from(code.replace(/\s/g,''),'base64').toString('utf8'));
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');

(async()=>{
 fs.mkdirSync(output,{recursive:false});
 const sourceReceipt=JSON.parse(fs.readFileSync(path.join(source,'receipt.json'),'utf8'));
 assert.equal(sourceReceipt.passed,true);assert.equal(sourceReceipt.platform,'android');
 const code=fs.readFileSync(path.join(source,'current-native-backup.txt'),'utf8'),expected=decode(code);
 const sourceIDs=new Set(['synthetic-a','synthetic-b',sourceReceipt.retainedSyntheticProfileId]);
 assert.ok(sourceReceipt.retainedSyntheticProfileId&&expected.PR.list.every(p=>sourceIDs.has(p.id)),'Only the exact synthetic source SDK receipt IDs');
 const portable=JSON.parse(fs.readFileSync(path.join(source,'portable-backup-receipt.json'),'utf8'));
 assert.equal(hash(code),portable.portableCodeSha256);assert.equal(Buffer.byteLength(code),portable.bytes);
 const receipt={passed:false,platform:'android',scope:'manual exported-code recovery into a fresh Android user/app sandbox',sourceSHA256:hash(code),ordinaryBuild:true};
 fs.writeFileSync(path.join(output,'incoming-native-backup.txt'),code);
 let device,page,user,prior,completed=false;
 async function connect(id){
  await device?.close();device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);assert.ok(device);
  adb('shell','am','start','--user',String(id),'-W','-n',app+'/.MainActivity');
  page=await(await device.webView({pkg:app})).page();page.setDefaultTimeout(45000);
  await page.waitForFunction(()=>GrovePlatform.persistenceReady&&typeof GROVE_STARTED!=='undefined');
  await page.evaluate(()=>GROVE_STARTED);
  assert.equal(await page.evaluate(()=>typeof GroveNativeTest),'undefined','Ordinary package only');
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[],'Native data never enters browser localStorage');
 }
 try{
  assert.match(adb('emu','avd','name'),/^Grove_API36_Play/);
  assert.equal(adb('shell','am','get-current-user'),'0','Begin from the preserved owner sandbox');
  assert.equal(adb('shell','settings','get','global','airplane_mode_on'),'1');
  await connect(0);
  assert.ok((await page.evaluate(()=>GROVE_REPOSITORY.peekRegistry())).list.every(p=>p.id.startsWith('synthetic-')),'Refuse to change focus away from unrecognized learner data');
  prior=await page.evaluate(()=>backup());fs.writeFileSync(path.join(output,'owner-prior-backup.txt'),prior);
  const ownerIdentity=await page.evaluate(()=>GrovePlatform.installationId);receipt.ownerInstallationIdSHA256=hash(ownerIdentity);
  await device.close();device=undefined;adb('shell','am','force-stop','--user','0',app);
  const resume=process.env.GROVE_RECOVERY_RESUME_USER_RECEIPT;
  if(resume){
   const failed=JSON.parse(fs.readFileSync(resume,'utf8')),creation=JSON.parse(fs.readFileSync(path.join(path.dirname(resume),'created-user.json'),'utf8'));
   assert.equal(failed.passed,false);assert.equal(failed.ownerProgressUnchanged,true);assert.equal(failed.ownerInstallationIdSHA256,hash(ownerIdentity));
   assert.equal(failed.retainedUserId,creation.user);assert.equal(fs.readFileSync(path.join(path.dirname(resume),'owner-prior-backup.txt'),'utf8'),prior);
   user=creation.user;assert.ok(Number.isInteger(user)&&user>0);receipt.resumedOwnedUserReceipt=path.resolve(resume);
   fs.writeFileSync(path.join(output,'created-user.json'),JSON.stringify(creation,null,2)+'\n');
  }else{
   const creation=adb('shell','pm','create-user','--for-testing','Grove-local-restore-'+crypto.randomUUID().slice(0,8));
   const match=creation.match(/^Success: created user id (\d+)$/);assert.ok(match,creation);user=Number(match[1]);assert.ok(user>0);
   fs.writeFileSync(path.join(output,'created-user.json'),JSON.stringify({user,creation},null,2)+'\n');
  }
  receipt.retainedUserId=user;
  adb('shell','pm','install-existing','--user',String(user),app);adb('shell','am','switch-user',String(user));
  // switch-user returns before first-user CE storage/package startup completes.
  // Wait for the supported user state and actual resolver; never bypass a lock.
  receipt.startedUserStates=[];
  const deadline=Date.now()+60000;
  for(;;){
   const state=adb('shell','am','get-started-user-state',String(user));
   const resolved=adb('shell','cmd','package','resolve-activity','--brief','--user',String(user),'-n',app+'/.MainActivity');
   receipt.startedUserStates.push({state,activityResolved:resolved.includes(app+'/.MainActivity')});
   if(state==='RUNNING_UNLOCKED'&&resolved.includes(app+'/.MainActivity'))break;
   assert.ok(Date.now()<deadline,'New user did not become unlocked/launchable; preserve it for investigation');
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  await connect(user);assert.equal(adb('shell','am','get-current-user'),String(user));
  const fresh=await page.evaluate(async()=>({registry:await GROVE_REPOSITORY.peekRegistry(),recovery:await GROVE_REPOSITORY.exportRecovery(),code:await backup(),identity:GrovePlatform.installationId}));
  assert.deepEqual(fresh.registry.list,[],'Actual new app sandbox has no learner registry');
  assert.deepEqual(fresh.recovery.originals,[],'No old imported source in the fresh sandbox');
  assert.notEqual(fresh.identity,ownerIdentity,'Independent native installation identity');
  fs.writeFileSync(path.join(output,'fresh-before.json'),JSON.stringify(fresh,null,2)+'\n');
  await page.evaluate(()=>grown('backup'));
  await page.getByRole('button',{name:'Restore from a backup code',exact:true}).click();
  await page.locator('#grt').fill(code);await page.locator('#grr').waitFor();
  assert.equal(await page.evaluate(()=>backup()),fresh.code,'Preview does not write a fresh destination');
  await page.locator('#grr').click();await page.waitForFunction(()=>!document.getElementById('grr'));
  const restored=await page.evaluate(()=>backup());assert.deepEqual(decode(restored),expected,'Every raw profile, reward, draft and unknown field restored');
  const recovery=await page.evaluate(()=>GROVE_REPOSITORY.exportRecovery());assert.ok(recovery.originals.some(o=>o.code===code),'Exact original exported code retained');
  fs.writeFileSync(path.join(output,'fresh-restored-backup.txt'),restored);await page.screenshot({path:path.join(output,'fresh-restored.png')});
  await device.close();device=undefined;adb('shell','am','force-stop','--user',String(user),app);
  await connect(user);assert.deepEqual(decode(await page.evaluate(()=>backup())),expected,'Manual recovery remains durable through actual force-stop/relaunch');
  assert.equal(await page.evaluate(()=>GrovePlatform.installationId),fresh.identity);
  receipt.freshEmptySandbox=true;receipt.independentInstallationIdentity=true;receipt.previewReadOnly=true;
  receipt.exactOriginalRetained=true;receipt.rawProfileAndEnvelopeValuesExact=true;receipt.actualProcessRestart=true;receipt.airplaneMode=true;
  receipt.sourcePortableReceipt=portable;receipt.newSandboxRetained=true;
  completed=true;
 }catch(error){receipt.error=String(error);throw error;
 }finally{
  try{
   await device?.close();device=undefined;
   if(user!==undefined){
    adb('shell','am','force-stop','--user',String(user),app);adb('shell','am','switch-user','0');await connect(0);
    const after=await page.evaluate(()=>backup());fs.writeFileSync(path.join(output,'owner-after-backup.txt'),after);
    assert.equal(after,prior,'Original owner sandbox remains byte-identical');receipt.ownerProgressUnchanged=true;
   }
  }catch(error){receipt.teardownError=String(error);
  }finally{await device?.close();}
  receipt.passed=!!(completed&&receipt.ownerProgressUnchanged&&!receipt.teardownError);
  fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 }
 assert.equal(receipt.passed,true);console.log('PASS ordinary Android fresh-user local save recovery: preview/import/exact original/offline relaunch; original owner backup unchanged');
})().catch(error=>{console.error(error);process.exitCode=1;});
