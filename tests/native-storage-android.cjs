// Actual APK, dedicated synthetic AVD, real SQLite, airplane mode and OS kills.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync,spawnSync}=require('node:child_process'),{DatabaseSync}=require('node:sqlite');
const {_android}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const sdk=process.env.ANDROID_HOME,serial=process.env.GROVE_ANDROID_SERIAL,output=process.env.GROVE_NATIVE_EVIDENCE,app='io.github.anandman.mandaringrove';
assert.ok(sdk&&serial&&output,'Explicit SDK, dedicated serial and new ignored evidence directory required');
const adb=(...args)=>execFileSync(path.join(sdk,'platform-tools/adb'),['-s',serial,...args],{encoding:'utf8'}).trim();
const fixtures=Object.fromEntries(['original-v1','grove-v1'].map(n=>[n,JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/backups',n+'.json'),'utf8'))]));
const scenarios=fs.readFileSync(path.join(__dirname,'fixtures/native-scenarios.js'),'utf8');
(async()=>{
 fs.mkdirSync(output,{recursive:false});const receipt={platform:'android',syntheticOnly:true,checks:[],passed:false};let device;
 try{
  assert.match(adb('emu','avd','name'),/^Grove_API36_Play/,'Use only the Grove synthetic AVD');
  adb('shell','cmd','connectivity','airplane-mode','enable');adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');assert.equal(adb('shell','settings','get','global','airplane_mode_on'),'1');
  device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);assert.ok(device);
  async function launch(){
   // A stopped WebView socket can remain in the previous Android client's list.
   // Reconnect the supported client for each actual OS process incarnation.
   await device?.close();device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);assert.ok(device);
   adb('shell','am','start','-W','-n',app+'/.MainActivity');const page=await(await device.webView({pkg:app})).page();page.setDefaultTimeout(20000);await page.waitForFunction(()=>GrovePlatform.persistenceReady&&typeof GROVE_STARTED!=='undefined');await page.evaluate(()=>GROVE_STARTED);await page.evaluate(scenarios);await page.evaluate(()=>GroveNativeScenarios.syntheticOnly());return page;
  }
  function stop(){adb('shell','am','force-stop',app);const pid=spawnSync(path.join(sdk,'platform-tools/adb'),['-s',serial,'shell','pidof',app],{encoding:'utf8'});assert.equal(pid.stdout.trim(),'','OS process is gone');assert.equal(pid.status,1);}
  function copyDatabase(label){
   const target=path.join(output,label);fs.mkdirSync(target);const names=adb('shell','run-as',app,'ls','databases').split(/\s+/).filter(n=>/^mandarin_groveSQLite\.db(?:-wal|-shm)?$/.test(n));assert.ok(names.includes('mandarin_groveSQLite.db'));
   for(const name of names)fs.writeFileSync(path.join(target,name),execFileSync(path.join(sdk,'platform-tools/adb'),['-s',serial,'exec-out','run-as',app,'cat','databases/'+name]));
   const db=new DatabaseSync(path.join(target,'mandarin_groveSQLite.db'),{readOnly:true});try{return Object.fromEntries(db.prepare('SELECT key,value FROM grove_entries').all().map(row=>[row.key,row.value]));}finally{db.close();}
  }
  let page=await launch();assert.equal(await page.evaluate(()=>GrovePlatform.platform),'android');assert.equal(await page.evaluate(()=>typeof window.chkVer),'undefined');
  for(const fixture of Object.values(fixtures))await page.evaluate(f=>GroveNativeScenarios.importFrozen(f),fixture);receipt.checks.push('Both frozen original/current backups preserve exact raw children, unknown fields, envelope and original code through actual SQLite');
  const practiced=await page.evaluate(f=>GroveNativeScenarios.practice(f),fixtures['original-v1']);fs.writeFileSync(path.join(output,'after-practice.txt'),practiced.code);stop();
  const disk=copyDatabase('practice-killed');assert.equal(JSON.parse(disk['zh_p_synthetic-a']).stars,practiced.after);page=await launch();
  const reopened=JSON.parse(Buffer.from(await page.evaluate(()=>backup()),'base64').toString('utf8')),expected=JSON.parse(Buffer.from(practiced.code,'base64').toString('utf8'));assert.deepEqual(reopened,expected);receipt.checks.push('Actual two-question offline UI round earns exactly two rewards; OS force-stop, fresh process and backup re-export preserve all progress');
  receipt.diskFull=await page.evaluate(()=>GroveNativeScenarios.diskFull());receipt.checks.push('Real native SQLITE_FULL rejects without changing acknowledged snapshot');
  for(const stage of ['before','after']){
   await page.evaluate(f=>GroveNativeScenarios.importFrozen(f),fixtures['original-v1']);
   const baseline=await page.evaluate(()=>GroveNativeTest.database.readSnapshot());
   await page.evaluate(({stage,fixture})=>{GroveNativeTest.holdNextCommit(stage);window.syntheticPausedImport=GROVE_REPOSITORY.importBackup(GroveNativeScenarios.encode(fixture));void window.syntheticPausedImport.catch(()=>{});},{stage,fixture:fixtures['grove-v1']});
   await page.waitForFunction(stage=>GroveNativeTest.phase===stage,stage);stop();const raw=copyDatabase('commit-'+stage+'-killed');
   const want=stage==='before'?fixtures['original-v1']:fixtures['grove-v1'];assert.deepEqual(JSON.parse(raw.zh_profiles),want.PR);for(const[id,value]of Object.entries(want.data))assert.equal(raw['zh_p_'+id],value);
   page=await launch();const recovered=await page.evaluate(()=>GroveNativeTest.database.readSnapshot()),committedRevision=baseline.revision+(stage==='after'?1:0);assert.ok(recovered.revision>=committedRevision&&recovered.revision<=committedRevision+1,'At most the normal active-child bootstrap save follows recovery');assert.equal(recovered.profiles['synthetic-b'],want.data['synthetic-b']);
   assert.equal((await page.evaluate(()=>GROVE_REPOSITORY.peekProfile('synthetic-a'))).stars,JSON.parse(want.data['synthetic-a']).stars);receipt.checks.push('Actual Android process killed '+stage+' COMMIT: copied DB/WAL all-or-none, fresh process recovers expected rewards');
  }
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);fs.writeFileSync(path.join(output,'android-native-storage.png'),execFileSync(path.join(sdk,'platform-tools/adb'),['-s',serial,'exec-out','screencap','-p']));receipt.passed=true;console.log('PASS actual Android SQLite frozen backups, offline round, disk-full, before/after-COMMIT OS kills and fresh-process recovery');
 }finally{await device?.close();fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
})().catch(error=>{console.error(error);process.exitCode=1;});
