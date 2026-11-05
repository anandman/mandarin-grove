// Actual process death after erasure COMMIT, before physical cleanup/ACK.
// Dedicated synthetic AVD only. Preserve prior originals and restore progress.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync,spawnSync}=require('node:child_process'),{DatabaseSync}=require('node:sqlite');
const {_android}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const sdk=process.env.ANDROID_HOME,serial=process.env.GROVE_ANDROID_SERIAL,output=process.env.GROVE_NATIVE_EVIDENCE,app='design.highgain.mandaringrove';
assert.ok(sdk&&serial&&output,'Explicit SDK, dedicated serial and fresh ignored evidence directory required');
const adb=(...args)=>execFileSync(path.join(sdk,'platform-tools/adb'),['-s',serial,...args],{encoding:'utf8'}).trim();
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function preserve(label,envelope){
 const dir=path.join(output,label);fs.mkdirSync(dir);
 for(const f of envelope.files){assert.match(f.name,/^mandarin_groveSQLite[.]db(?:-wal|-shm)?$/);const bytes=Buffer.from(f.base64,'base64');assert.equal(hash(bytes),f.sha256);fs.writeFileSync(path.join(dir,f.name),bytes);}
}
(async()=>{
 fs.mkdirSync(output,{recursive:false});const receipt={platform:'android',scope:'actual erasure process death and bootstrap',syntheticOnly:true,passed:false};let device;
 try{
  assert.match(adb('emu','avd','name'),/^Grove_API36_Play/);assert.equal(adb('shell','settings','get','global','airplane_mode_on'),'1');
  async function launch(){
   await device?.close();device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);assert.ok(device);
   adb('shell','am','start','-W','-n',app+'/.MainActivity');const page=await(await device.webView({pkg:app})).page();page.setDefaultTimeout(20000);await page.waitForFunction(()=>GrovePlatform.persistenceReady&&typeof GROVE_STARTED!=='undefined');await page.evaluate(()=>GROVE_STARTED);await page.evaluate(fs.readFileSync(path.join(__dirname,'fixtures/native-scenarios.js'),'utf8'));await page.evaluate(()=>GroveNativeScenarios.syntheticOnly());return page;
  }
  let page=await launch();
  const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/backups/original-v1.json'),'utf8'));
  // This erase test never starts a picker or creates staging. Refuse to erase
  // any abandoned copies rather than losing unarchived prior proof material.
  const listing=spawnSync(path.join(sdk,'platform-tools/adb'),['-s',serial,'shell','run-as',app,'ls','-1','no_backup/grove-pending-exports'],{encoding:'utf8'});
  assert.ok(listing.status===0?listing.stdout.trim()==='':/No such file or directory/.test(listing.stdout+listing.stderr),'Archive prior staging before running erasure');
  const prepared=await page.evaluate(f=>GroveNativeScenarios.prepareErasure(f),fixture);
  fs.writeFileSync(path.join(output,'prepared.json'),JSON.stringify(prepared));preserve('prior-originals',prepared.priorFiles);preserve('before-erase',prepared.beforeFiles);fs.writeFileSync(path.join(output,'preserved-selected-backup.txt'),prepared.priorBackup);
  await page.evaluate(()=>{GroveNativeTest.holdNextCommit('after');window.syntheticPausedErase=GROVE_REPOSITORY.eraseLocal();void window.syntheticPausedErase.catch(()=>{});});
  await page.waitForFunction(()=>GroveNativeTest.phase==='after');const pid=adb('shell','pidof',app);assert.match(pid,/^[0-9]+$/);
  adb('shell','am','force-stop',app);assert.equal(spawnSync(path.join(sdk,'platform-tools/adb'),['-s',serial,'shell','pidof',app],{encoding:'utf8'}).stdout.trim(),'','App process really stopped');
  const target=path.join(output,'killed');fs.mkdirSync(target);
  for(const name of adb('shell','run-as',app,'ls','databases').split(/\s+/).filter(n=>/^mandarin_groveSQLite[.]db(?:-wal|-shm)?$/.test(n)))fs.writeFileSync(path.join(target,name),execFileSync(path.join(sdk,'platform-tools/adb'),['-s',serial,'exec-out','run-as',app,'cat','databases/'+name]));
  const db=new DatabaseSync(path.join(target,'mandarin_groveSQLite.db'),{readOnly:true});
  try{assert.equal(db.prepare('SELECT erase_pending FROM grove_meta WHERE id=1').get().erase_pending,1);assert.equal(db.prepare('SELECT count(*) AS n FROM grove_entries').get().n,0);assert.equal(db.prepare('SELECT count(*) AS n FROM grove_originals').get().n,0);}finally{db.close();}
  assert.ok(fs.readdirSync(target).some(n=>fs.readFileSync(path.join(target,n)).includes(Buffer.from(prepared.retired))),'Private retired pages still need bootstrap cleanup');
  page=await launch();
  const cleaned=await page.evaluate(async()=>{GroveNativeScenarios.equal((await GroveNativeTest.database.readSnapshot()).profiles,{},'No learner exposed after interrupted erase');const m=(await GroveNativeTest.connection.query('SELECT erase_pending FROM grove_meta WHERE id=1')).values[0];GroveNativeScenarios.equal(m.erase_pending,0,'Bootstrap cleaned before readiness');const r=await GroveNativeTest.database.exportRecovery();GroveNativeScenarios.equal(r.originals,[],'No original recovery codes');GroveNativeScenarios.check(r.revisions.every(r=>!r.before),'No learner recovery revisions');return await GrovePlatform.files.rawRecovery();});
  preserve('bootstrap-cleaned',cleaned);for(const f of cleaned.files)for(const marker of [prepared.retired,prepared.current,prepared.original])assert.equal(Buffer.from(f.base64,'base64').includes(Buffer.from(marker)),false);
  assert.equal(fs.readFileSync(path.join(output,'preserved-selected-backup.txt'),'utf8'),prepared.priorBackup);
  const restored=await page.evaluate(async code=>{await GROVE_REPOSITORY.importBackup(code);PR=await GROVE_REPOSITORY.readRegistry();GROVE_SAVED_REGISTRY=groveCopy(PR);await loadS({persist:false});await home();return await backup();},prepared.priorBackup);assert.equal(restored,prepared.priorBackup);
  Object.assign(receipt,{killedPid:pid,osForceStop:true,logicalEraseAndPendingMarkerVerifiedBeforeRelaunch:true,privatePagesPresentBeforeRelaunch:true,privateMarkersAbsentAfterBootstrap:true,noLearnerExposedBeforeCleanup:true,selectedBackupUnchanged:true,priorOriginalsArchived:true,priorSyntheticProgressRestoredExactly:true,passed:true});console.log('PASS actual Android erasure process death, physical pending marker, fresh bootstrap cleanup, exact prior-progress restoration');
 }finally{await device?.close();fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
})().catch(error=>{console.error(error);process.exitCode=1;});
