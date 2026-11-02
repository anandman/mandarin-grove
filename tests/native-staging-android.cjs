// Actual system-picker cancellation and bounded app-private staging ownership.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync,spawnSync}=require('node:child_process');
const {_android}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const sdk=process.env.ANDROID_HOME,serial=process.env.GROVE_ANDROID_SERIAL,output=process.env.GROVE_NATIVE_EVIDENCE,app='io.github.anandman.mandaringrove';
assert.ok(sdk&&serial&&output,'Explicit SDK, dedicated serial and new ignored evidence directory required');
const executable=path.join(sdk,'platform-tools/adb'),args=['-s',serial],adb=(...rest)=>execFileSync(executable,[...args,...rest],{encoding:'utf8'}).trim();
function stages(){
 const r=spawnSync(executable,[...args,'exec-out','run-as',app,'ls','-1','no_backup/grove-pending-exports'],{encoding:'utf8'});
 if(r.status!==0){assert.match(r.stdout+r.stderr,/No such file or directory/);return [];}
 return r.stdout.trim().split(/\s+/).filter(Boolean).sort();
}
function ui(label){
 const remote='/data/local/tmp/grove-staging-'+label+'.xml';adb('shell','uiautomator','dump',remote);const xml=adb('exec-out','cat',remote);fs.writeFileSync(path.join(output,label+'.xml'),xml);
 return [...xml.matchAll(/<node\b[^>]*>/g)].map(m=>Object.fromEntries([...m[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]])));
}
function tapNode(node){assert.ok(node);const [x1,y1,x2,y2]=node.bounds.match(/\d+/g).map(Number);adb('shell','input','tap',String((x1+x2)/2|0),String((y1+y2)/2|0));}
(async()=>{
 fs.mkdirSync(output,{recursive:false});let device;const receipt={platform:'android',scope:'actual system export cancel',passed:false};
 try{
  assert.match(adb('emu','avd','name'),/^Grove_API36_Play/);device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);assert.ok(device);
  adb('shell','am','start','-W','-n',app+'/.MainActivity');const page=await(await device.webView({pkg:app})).page();await page.waitForFunction(()=>GrovePlatform.persistenceReady&&typeof GROVE_STARTED!=='undefined');await page.evaluate(()=>GROVE_STARTED);
  await page.evaluate(fs.readFileSync(path.join(__dirname,'fixtures/native-scenarios.js'),'utf8'));await page.evaluate(()=>GroveNativeScenarios.syntheticOnly());
  const before=stages(),backup=await page.evaluate(()=>backup()),name='grove-staging-'+crypto.randomUUID()+'.txt',text='\ufeff\nsynthetic staged backup\r\n';
  await page.evaluate(({name,text})=>{window.syntheticStagingResult=null;window.syntheticStagingError=null;GrovePlatform.files.saveText({name,text,mimeType:'text/plain'}).then(r=>syntheticStagingResult=r,e=>syntheticStagingError=String(e));},{name,text});
  const remote='/data/local/tmp/'+name+'.xml';adb('shell','uiautomator','dump',remote);const xml=adb('exec-out','cat',remote);fs.writeFileSync(path.join(output,'actual-picker.xml'),xml);assert.match(xml,/(?:com\.google\.android|com\.android)\.documentsui/);assert.ok(xml.includes(name));
  const during=stages(),created=during.filter(n=>!before.includes(n));assert.equal(created.length,1);assert.match(created[0],/^export-[A-Za-z0-9-]+[.]utf8$/);
  const staged=execFileSync(executable,[...args,'exec-out','run-as',app,'cat','no_backup/grove-pending-exports/'+created[0]]);assert.deepEqual(staged,Buffer.from(text));fs.writeFileSync(path.join(output,'preserved-test-payload.utf8'),staged);
  adb('shell','input','keyevent','KEYCODE_BACK');await page.waitForFunction(()=>syntheticStagingResult||syntheticStagingError);assert.equal(await page.evaluate(()=>syntheticStagingError),null);assert.deepEqual(await page.evaluate(()=>syntheticStagingResult),{saved:false});
  assert.deepEqual(stages(),before,'Cancel removes only its app-generated staging copy');assert.equal(await page.evaluate(()=>backup()),backup);
  await page.evaluate(()=>grown());
  for(const partial of [false,true]){
   const label=partial?'saved-cleanup-refused':'saved',filename='grove-staging-'+label+'-'+crypto.randomUUID()+'.txt',expected=await page.evaluate(()=>backup()),baseline=stages();
   await page.evaluate(()=>document.getElementById('backup-status').textContent='');await page.getByRole('button',{name:'Download backup file',exact:true}).click();
   const edits=ui(label+'-name').filter(n=>n['resource-id']==='android:id/title'&&n.class==='android.widget.EditText');assert.equal(edits.length,1);tapNode(edits[0]);
   adb('shell','input','keyevent','KEYCODE_MOVE_END',...Array(edits[0].text.length+2).fill('KEYCODE_DEL'));adb('shell','input','text',filename);
   const renamed=ui(label+'-renamed');assert.ok(renamed.some(n=>n.class==='android.widget.EditText'&&n.text===filename));
   const pending=stages().filter(n=>!baseline.includes(n));assert.equal(pending.length,1);const stageBytes=execFileSync(executable,[...args,'exec-out','run-as',app,'cat','no_backup/grove-pending-exports/'+pending[0]]);assert.equal(stageBytes.toString('utf8'),expected);fs.writeFileSync(path.join(output,label+'-staged.txt'),stageBytes);
   try{
    if(partial)adb('shell','run-as',app,'chmod','500','no_backup/grove-pending-exports');
    tapNode(renamed.find(n=>n['resource-id']==='android:id/button1'&&n.text==='SAVE'));
    await page.waitForFunction(partial=>{const t=document.getElementById('backup-status')?.textContent||'';return partial?t.includes('temporary copy'):t.startsWith('Backup file saved.');},partial);
    const status=await page.locator('#backup-status').innerText();assert.match(status,/^Backup file saved\./);assert.doesNotMatch(status,/Could not prepare/);
    const saved=execFileSync(executable,[...args,'exec-out','cat','/sdcard/Download/'+filename]);assert.equal(saved.toString('utf8'),expected);fs.writeFileSync(path.join(output,filename),saved);assert.equal(await page.evaluate(()=>backup()),backup);
    assert.deepEqual(stages(),partial?[...baseline,...pending].sort():baseline,'Saved destination is kept; only current staging is removed or truthfully reported');
   }finally{if(partial)adb('shell','run-as',app,'chmod','700','no_backup/grove-pending-exports');}
  }
  Object.assign(receipt,{legacyStageNamesUnchanged:true,exactUtf8:true,learnerBackupUnchanged:true,normalSaveRemovesStaging:true,realSavedCleanupFailureTruthful:true,selectedFilesPreserved:true,passed:true});console.log('PASS actual Android cancel/save cleanup and saved-file failure status; progress, prior staging and selected backups preserved');
 }finally{await device?.close();fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
