// Actual system-picker cancellation and bounded app-private staging ownership.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync,spawnSync}=require('node:child_process');
const {_android}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const sdk=process.env.ANDROID_HOME,serial=process.env.GROVE_ANDROID_SERIAL,output=process.env.GROVE_NATIVE_EVIDENCE,app='design.highgain.mandaringrove';
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
 fs.mkdirSync(output,{recursive:false});let device,page;const receipt={platform:'android',scope:'actual system picker result after background-process death',syntheticOnly:true,passed:false};
 async function connect(start){await device?.close();device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);assert.ok(device);if(start)adb('shell','am','start','-W','-n',app+'/.MainActivity');page=await(await device.webView({pkg:app})).page();page.setDefaultTimeout(20000);await page.waitForFunction(()=>GrovePlatform.persistenceReady&&typeof GROVE_STARTED!=='undefined');await page.evaluate(()=>GROVE_STARTED);await page.evaluate(fs.readFileSync(path.join(__dirname,'fixtures/native-scenarios.js'),'utf8'));await page.evaluate(()=>GroveNativeScenarios.syntheticOnly());}
 try{
  assert.match(adb('emu','avd','name'),/^Grove_API36_Play/);await connect(true);const before=await page.evaluate(()=>backup());fs.writeFileSync(path.join(output,'preserved-progress.txt'),before);
  const filename='grove-restored-save-'+crypto.randomUUID()+'.txt';await page.evaluate(()=>grown('backup'));await page.getByRole('button',{name:'Download backup file',exact:true}).click();
  const edit=ui('save-name').find(n=>n['resource-id']==='android:id/title'&&n.class==='android.widget.EditText');assert.ok(edit);tapNode(edit);adb('shell','input','keyevent','KEYCODE_MOVE_END',...Array(edit.text.length+2).fill('KEYCODE_DEL'));adb('shell','input','text',filename);
  const pending=stages();assert.equal(pending.length,1);const staged=execFileSync(executable,[...args,'exec-out','run-as',app,'cat','no_backup/grove-pending-exports/'+pending[0]]);assert.equal(staged.toString('utf8'),before);fs.writeFileSync(path.join(output,'preserved-staging.txt'),staged);
  const oldPid=adb('shell','pidof',app);assert.match(oldPid,/^[0-9]+$/);await device.close();device=undefined;adb('shell','am','kill',app);
  const killed=spawnSync(executable,[...args,'shell','pidof',app],{encoding:'utf8'});assert.equal(killed.stdout.trim(),'','Actual background app process died while system picker remains');
  const picker=ui('picker-after-kill');assert.ok(picker.some(n=>n.package.endsWith('.documentsui')));assert.ok(picker.some(n=>n.class==='android.widget.EditText'&&n.text===filename));tapNode(picker.find(n=>n['resource-id']==='android:id/button1'&&n.text==='SAVE'));
  await connect(false);receipt.oldPid=oldPid;receipt.newPid=adb('shell','pidof',app);assert.notEqual(receipt.newPid,oldPid);
  const saved=execFileSync(executable,[...args,'exec-out','cat','/sdcard/Download/'+filename]);assert.equal(saved.toString('utf8'),before,'Restored native callback writes exact selected file');fs.writeFileSync(path.join(output,filename),saved);receipt.selectedFileExact=true;
  assert.equal(await page.evaluate(()=>backup()),before,'Process restoration does not change learner progress');assert.deepEqual(stages(),[],'Restored callback cleans only its own staging');receipt.progressUnchanged=true;
  assert.equal(await page.locator('#gov').count(),0,'Restored result does not bypass the parent gate');
  await page.locator('#native-file-notice').waitFor({timeout:15000});assert.doesNotMatch(await page.locator('#native-file-notice').innerText(),/Synthetic Ada|Synthetic Bo|base64/);
  await page.evaluate(()=>grown('backup'));await page.waitForFunction(()=>document.getElementById('backup-status')?.textContent.startsWith('File saved.'));assert.equal(await page.locator('#native-file-notice').count(),0);
  receipt.checks=['Restored Save writes exact selected bytes, removes its private copy and waits for Grown-ups'];
  async function enter(){await page.evaluate(()=>{document.getElementById('gov')?.remove();return grown('backup');});}
  async function killAndReturn(label,finish){
   const old=adb('shell','pidof',app);assert.match(old,/^[0-9]+$/);await device.close();device=undefined;adb('shell','am','kill',app);assert.equal(spawnSync(executable,[...args,'shell','pidof',app],{encoding:'utf8'}).stdout.trim(),'');
   assert.ok(ui(label+'-picker').some(n=>n.package.endsWith('.documentsui')));finish();await connect(false);assert.notEqual(adb('shell','pidof',app),old);assert.equal(await page.locator('#gov').count(),0);assert.equal(await page.locator('#grr').count(),0);assert.equal(await page.evaluate(()=>backup()),before);await page.locator('#native-file-notice').waitFor();assert.doesNotMatch(await page.locator('#native-file-notice').innerText(),/Synthetic|base64/);await enter();assert.equal(await page.locator('#native-file-notice').count(),0);
  }
  await enter();await page.getByRole('button',{name:'Download backup file',exact:true}).click();ui('save-cancel-open');
  const cancelledStage=stages();assert.equal(cancelledStage.length,1);fs.writeFileSync(path.join(output,'cancelled-stage-preserved.txt'),execFileSync(executable,[...args,'exec-out','run-as',app,'cat','no_backup/grove-pending-exports/'+cancelledStage[0]]));
  await killAndReturn('save-cancel',()=>adb('shell','input','keyevent','KEYCODE_BACK'));await page.waitForFunction(()=>document.getElementById('backup-status')?.textContent.includes('cancelled'));assert.deepEqual(stages(),[]);receipt.checks.push('Restored Save cancellation preserves progress and removes only its generated copy');
  const incoming=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/backups/grove-v1.json'),'utf8'));incoming.nativeRestorationProof='synthetic-'+crypto.randomUUID();
  const exact='\ufeff\n'+Buffer.from(JSON.stringify(incoming)).toString('base64')+'\r\n',inputName='grove-restored-open-'+crypto.randomUUID()+'.txt',input=path.join(output,inputName);fs.writeFileSync(input,exact);adb('push',input,'/sdcard/Download/'+inputName);
  await enter();await page.getByRole('button',{name:'Restore from backup file',exact:true}).click();ui('open-before-kill');
  await killAndReturn('open',()=>{const nodes=ui('open-selected');tapNode(nodes.find(n=>n.text===inputName));});await page.locator('#grr').waitFor();assert.equal(await page.evaluate(()=>backup()),before);assert.equal(execFileSync(executable,[...args,'exec-out','cat','/sdcard/Download/'+inputName]).toString('utf8'),exact);
  await page.locator('#grr').click();await page.waitForFunction(()=>!document.getElementById('grr'));assert.deepEqual(JSON.parse(Buffer.from(await page.evaluate(()=>backup()),'base64').toString('utf8')),incoming);assert.ok((await page.evaluate(()=>GROVE_REPOSITORY.exportRecovery())).originals.some(o=>o.code===exact),'Exact original BOM/CRLF remains durable');
  await page.evaluate(async code=>{await GROVE_REPOSITORY.importBackup(code);PR=await GROVE_REPOSITORY.readRegistry();GROVE_SAVED_REGISTRY=groveCopy(PR);await loadS({persist:false});await home();},before);assert.equal(await page.evaluate(()=>backup()),before);receipt.checks.push('Restored actual selection waits for parent entry, previews only, explicit Replace preserves raw/unknown fields and exact original bytes; prior progress restored');
  await enter();await page.getByRole('button',{name:'Restore from backup file',exact:true}).click();ui('open-cancel-before-kill');await killAndReturn('open-cancel',()=>adb('shell','input','keyevent','KEYCODE_BACK'));await page.waitForFunction(()=>document.getElementById('backup-status')?.textContent.includes('cancelled'));assert.equal(await page.locator('#grr').count(),0);receipt.checks.push('Restored Open cancellation creates no preview/import');
  const invalidName='grove-restored-invalid-'+crypto.randomUUID()+'.txt',invalid=path.join(output,invalidName);fs.writeFileSync(invalid,Buffer.from([0xff,0xfe,0x61]));adb('push',invalid,'/sdcard/Download/'+invalidName);
  await enter();await page.getByRole('button',{name:'Restore from backup file',exact:true}).click();ui('open-invalid-before-kill');await killAndReturn('open-invalid',()=>{tapNode(ui('open-invalid-selected').find(n=>n.text===invalidName));});await page.waitForFunction(()=>document.getElementById('backup-status')?.textContent.includes('valid UTF-8'));assert.equal(await page.locator('#grr').count(),0);receipt.checks.push('Restored actual UTF-8 failure stays bounded and leaves original/progress unchanged');
  await enter();await page.getByRole('button',{name:'Download backup file',exact:true}).click();const partialName='grove-restored-partial-'+crypto.randomUUID()+'.txt',partialEdit=ui('partial-name').find(n=>n['resource-id']==='android:id/title'&&n.class==='android.widget.EditText');tapNode(partialEdit);adb('shell','input','keyevent','KEYCODE_MOVE_END',...Array(partialEdit.text.length+2).fill('KEYCODE_DEL'));adb('shell','input','text',partialName);
  const partialStage=stages();assert.equal(partialStage.length,1);fs.writeFileSync(path.join(output,'partial-stage-preserved.txt'),execFileSync(executable,[...args,'exec-out','run-as',app,'cat','no_backup/grove-pending-exports/'+partialStage[0]]));
  try{
   adb('shell','run-as',app,'chmod','500','no_backup/grove-pending-exports');await killAndReturn('partial-save',()=>tapNode(ui('partial-save-selected').find(n=>n['resource-id']==='android:id/button1'&&n.text==='SAVE')));await page.waitForFunction(()=>document.getElementById('backup-status')?.textContent.includes('temporary copy'));assert.match(await page.locator('#backup-status').innerText(),/^File saved\./);assert.equal(execFileSync(executable,[...args,'exec-out','cat','/sdcard/Download/'+partialName]).toString('utf8'),before);assert.deepEqual(stages(),partialStage);
  }finally{adb('shell','run-as',app,'chmod','700','no_backup/grove-pending-exports');}
  // Only this test's known, already-preserved payload remains. Exercise the
  // bounded native cleanup API; selected Downloads are never deleted.
  assert.deepEqual(stages(),partialStage);await page.evaluate(()=>GrovePlatform.files.clearTemporaryFiles());assert.deepEqual(stages(),[]);assert.equal(await page.evaluate(()=>backup()),before);receipt.checks.push('Restored real save+cleanup refusal preserves saved file and reports success truthfully; known private test copy archived before bounded cleanup');
  receipt.passed=true;console.log('PASS six actual Android picker process-death cases: save/cancel/open/invalid UTF-8/partial save, parent gating, exact unknown/original preservation');
 }finally{await device?.close();fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
})().catch(error=>{console.error(error);process.exitCode=1;});
