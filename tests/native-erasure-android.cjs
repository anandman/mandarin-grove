// Actual pinned Android SQLite driver. Dedicated synthetic AVD only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {_android}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const sdk=process.env.ANDROID_HOME,serial=process.env.GROVE_ANDROID_SERIAL,output=process.env.GROVE_NATIVE_EVIDENCE,app='io.github.anandman.mandaringrove';
assert.ok(sdk&&serial&&output,'Explicit SDK, dedicated serial and new ignored evidence directory required');
const adb=(...args)=>execFileSync(path.join(sdk,'platform-tools/adb'),['-s',serial,...args],{encoding:'utf8'}).trim();
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function stagedNames(){
 const {spawnSync}=require('node:child_process'),r=spawnSync(path.join(sdk,'platform-tools/adb'),['-s',serial,'exec-out','run-as',app,'ls','-1','no_backup/grove-pending-exports'],{encoding:'utf8'});
 if(r.status!==0){assert.match(r.stdout+r.stderr,/No such file or directory/);return [];}
 return r.stdout.trim().split(/\s+/).filter(Boolean);
}
function preserve(label,envelope){
 const directory=path.join(output,label);fs.mkdirSync(directory);
 for(const f of envelope.files){assert.match(f.name,/^mandarin_groveSQLite\.db(?:-wal|-shm)?$/);const bytes=Buffer.from(f.base64,'base64');assert.equal(digest(bytes),f.sha256);fs.writeFileSync(path.join(directory,f.name),bytes);}
}
(async()=>{
 fs.mkdirSync(output,{recursive:false});const receipt={platform:'android',scope:'SQLite and app-generated export staging erasure; broader lifecycle/cloud gates remain',syntheticOnly:true,passed:false};let device;
 try{
  assert.match(adb('emu','avd','name'),/^Grove_API36_Play/);assert.equal(adb('shell','settings','get','global','airplane_mode_on'),'1');
  device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);assert.ok(device);
  adb('shell','am','start','-W','-n',app+'/.MainActivity');const page=await(await device.webView({pkg:app})).page();page.setDefaultTimeout(20000);
  await page.waitForFunction(()=>GrovePlatform.persistenceReady&&typeof GROVE_STARTED!=='undefined');await page.evaluate(()=>GROVE_STARTED);await page.evaluate(fs.readFileSync(path.join(__dirname,'fixtures/native-scenarios.js'),'utf8'));await page.evaluate(()=>GroveNativeScenarios.syntheticOnly());
  const prior=await page.evaluate(async()=>({code:await backup(),files:await GrovePlatform.files.rawRecovery()}));preserve('prior-originals',prior.files);fs.writeFileSync(path.join(output,'preserved-selected-backup.txt'),prior.code);
  const stages=stagedNames();fs.mkdirSync(path.join(output,'temporary-originals'));
  for(const token of stages){assert.match(token,/^export-[A-Za-z0-9-]+[.]utf8$/);assert.match(adb('shell','run-as',app,'stat','-c','%F','no_backup/grove-pending-exports/'+token),/^regular/);fs.writeFileSync(path.join(output,'temporary-originals',token),execFileSync(path.join(sdk,'platform-tools/adb'),['-s',serial,'exec-out','run-as',app,'cat','no_backup/grove-pending-exports/'+token]));}
  const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/backups/original-v1.json'),'utf8'));
  const prepared=await page.evaluate(f=>GroveNativeScenarios.prepareErasure(f),fixture);fs.writeFileSync(path.join(output,'prepared.json'),JSON.stringify(prepared));preserve('before-erase',prepared.beforeFiles);
  const after=await page.evaluate(p=>GroveNativeScenarios.eraseAndVerify(p),{retired:prepared.retired,current:prepared.current,original:prepared.original});preserve('after-erase',after);
  for(const f of after.files)for(const marker of [prepared.retired,prepared.current,prepared.original])assert.equal(Buffer.from(f.base64,'base64').includes(Buffer.from(marker)),false);
  assert.equal(fs.readFileSync(path.join(output,'preserved-selected-backup.txt'),'utf8'),prior.code);
  assert.deepEqual(stagedNames(),[],'Explicit Erase also removes abandoned app-generated copies');
  const restored=await page.evaluate(async code=>{await GROVE_REPOSITORY.importBackup(code);PR=await GROVE_REPOSITORY.readRegistry();GROVE_SAVED_REGISTRY=groveCopy(PR);await loadS({persist:false});await home();return await backup();},prior.code);assert.equal(restored,prior.code);
  Object.assign(receipt,{privateMainAndWalBytesAbsent:true,logicalProfilesOriginalsReportsOutboxCleared:true,privateStagingErased:true,priorStagingCopiesArchived:stages.length,selectedBackupUnchanged:true,priorOriginalDatabaseFilesPreserved:true,priorSyntheticProgressRestoredExactly:true,passed:true});console.log('PASS actual Android SQLite plus staging erase; external backup and all prior originals archived, prior synthetic progress restored');
 }finally{await device?.close();fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
})().catch(error=>{console.error(error);process.exitCode=1;});
