// Real Storage Access Framework dialogs, fixed private paths, synthetic AVD only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {_android}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const serial=process.env.GROVE_ANDROID_SERIAL,output=process.env.GROVE_NATIVE_EVIDENCE,sdk=process.env.ANDROID_HOME,app='io.github.anandman.mandaringrove';
assert.ok(serial&&output&&sdk);const adb=(...args)=>execFileSync(path.join(sdk,'platform-tools/adb'),['-s',serial,...args],{encoding:'utf8'}).trim();
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/backups/original-v1.json','utf8')),scenarios=fs.readFileSync('tests/fixtures/native-scenarios.js','utf8'),hash=data=>crypto.createHash('sha256').update(data).digest('hex');
(async()=>{
 fs.mkdirSync(output);const tag=path.basename(output),receipt={syntheticOnly:true,checks:[],passed:false};let device,page,future=false;
 async function connect(ready=true){await device?.close();device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);assert.ok(device);adb('shell','am','start','-W','-n',app+'/.MainActivity');page=await(await device.webView({pkg:app})).page();page.setDefaultTimeout(20000);await page.waitForFunction(()=>typeof GROVE_STARTED!=='undefined');await page.evaluate(()=>GROVE_STARTED);assert.equal(await page.evaluate(()=>GrovePlatform.persistenceReady),ready);if(ready){await page.evaluate(scenarios);await page.evaluate(()=>GroveNativeScenarios.syntheticOnly());}}
 async function restart(ready=true){await device?.close();device=undefined;adb('shell','am','force-stop',app);await connect(ready);}
 async function repairSyntheticFault(){await page.evaluate(async()=>{
  if(document.documentElement.dataset.nativeInternalTests!=='true')throw Error('Internal synthetic test package required');
  const c=Capacitor.Plugins.CapacitorSQLite,options={database:'mandarin_grove',readonly:false};
  await c.createConnection({...options,encrypted:false,mode:'no-encryption',version:1});await c.open(options);
  try{
   const meta=(await c.query({...options,statement:'SELECT schema_version FROM grove_meta WHERE id=1',values:[]})).values.find(r=>typeof r.schema_version==='number');
   const row=(await c.query({...options,statement:'SELECT value FROM grove_entries WHERE key=?',values:['zh_profiles']})).values.find(r=>typeof r.value==='string');
   if(meta.schema_version!==99||!JSON.parse(row.value).list.every(p=>p.id.startsWith('synthetic-')))throw Error('Refuse to change any real or unrecognized schema');
   await c.run({...options,statement:'UPDATE grove_meta SET schema_version=2 WHERE id=1',values:[],transaction:false});
  }finally{await c.closeConnection(options);}
 });}
 function ui(label){
  const remote='/data/local/tmp/grove-'+tag+'-'+label+'.xml';adb('shell','uiautomator','dump',remote);const xml=adb('exec-out','cat',remote);fs.writeFileSync(path.join(output,label+'.xml'),xml);
  return [...xml.matchAll(/<node\b[^>]*>/g)].map(m=>Object.fromEntries([...m[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]])));
 }
 function tap(label,selector){const nodes=ui(label).filter(n=>Object.entries(selector).every(([k,v])=>n[k]===v));assert.equal(nodes.length,1,'Exactly one observed native control '+JSON.stringify(selector));const [x1,y1,x2,y2]=nodes[0].bounds.match(/\d+/g).map(Number);adb('shell','input','tap',String((x1+x2)/2|0),String((y1+y2)/2|0));}
 function fileBytes(name){return execFileSync(path.join(sdk,'platform-tools/adb'),['-s',serial,'exec-out','cat','/sdcard/Download/'+name]);}
 async function save(name,text){
  await page.evaluate(({name,text})=>{window.syntheticFileResult=null;window.syntheticFileError=null;GrovePlatform.files.saveText({name,text,mimeType:'text/plain'}).then(r=>window.syntheticFileResult=r,e=>window.syntheticFileError=String(e));},{name,text});
  tap('save-'+name,{'resource-id':'android:id/button1',text:'SAVE'});await page.waitForFunction(()=>syntheticFileResult||syntheticFileError);assert.equal(await page.evaluate(()=>syntheticFileError),null);assert.equal(await page.evaluate(()=>syntheticFileResult.saved),true);assert.equal(fileBytes(name).toString('utf8'),text);
 }
 try{
  assert.match(adb('emu','avd','name'),/^Grove_API36_Play/);assert.equal(adb('shell','settings','get','global','airplane_mode_on'),'1');await restart();
  const id=await page.evaluate(()=>GrovePlatform.installationId);assert.match(id,/^[a-f0-9-]{36}$/);assert.equal(adb('shell','run-as',app,'cat','no_backup/grove-installation-identity'),id);receipt.checks.push('Stable installation UUID is in no_backup and excluded from learner export');
  await page.evaluate(()=>grown());const before=await page.evaluate(()=>backup());assert.ok(!before.includes(id));
  await page.getByRole('button',{name:'Restore from backup file',exact:true}).click();ui('open-cancel');adb('shell','input','keyevent','KEYCODE_BACK');await page.waitForFunction(()=>document.hasFocus());assert.equal(await page.evaluate(()=>backup()),before);receipt.checks.push('Actual system open-document cancellation preserves progress');
  const original='\ufeff\n'+Buffer.from(JSON.stringify(fixture)).toString('base64')+'\r\n',inputName=tag+'-original.txt',input=path.join(output,inputName);fs.writeFileSync(input,original);adb('push',input,'/sdcard/Download/'+inputName);
  await page.getByRole('button',{name:'Restore from backup file',exact:true}).click();tap('open-original',{text:inputName});await page.locator('#grr').waitFor();assert.equal(await page.evaluate(()=>backup()),before,'Opening actual OS file only previews');await page.locator('#grr').click();await page.waitForFunction(()=>!document.getElementById('grr'));
  const imported=JSON.parse(Buffer.from(await page.evaluate(()=>backup()),'base64').toString('utf8'));assert.deepEqual(imported,fixture);assert.ok((await page.evaluate(()=>GROVE_REPOSITORY.exportRecovery())).originals.some(r=>r.code===original));assert.equal(fileBytes(inputName).toString('utf8'),original);receipt.checks.push('Actual OS-selected UTF-8 file preview/restore preserves both raw children and exact original BOM/CRLF bytes; source file unchanged');
  await page.evaluate(()=>grown());const badName=tag+'-invalid.txt',bad=path.join(output,badName);fs.writeFileSync(bad,Buffer.from([0xff,0xfe,0x61]));adb('push',bad,'/sdcard/Download/'+badName);const valid=await page.evaluate(()=>backup());await page.getByRole('button',{name:'Restore from backup file',exact:true}).click();tap('open-invalid',{text:badName});await page.waitForFunction(()=>document.getElementById('backup-status')?.textContent.includes('valid UTF-8'));assert.equal(await page.evaluate(()=>backup()),valid);assert.equal(await page.locator('#grr').count(),0);receipt.checks.push('Actual native invalid UTF-8 input is refused without replacement');
  await page.evaluate(()=>document.getElementById('gov')?.remove());const practiced=await page.evaluate(f=>GroveNativeScenarios.practice(f),fixture);await restart();assert.equal(await page.evaluate(()=>backup()),practiced.code);
  const exported=tag+'-after-practice.txt';await save(exported,practiced.code);fs.writeFileSync(path.join(output,'after-practice-os-export.txt'),fileBytes(exported));receipt.checks.push('Actual import → offline UI round → OS stop → fresh launch → system picker save; file matches committed post-practice backup exactly');
  const c=await page.evaluate(async()=>{const c=GroveNativeTest.connection;await c.run('UPDATE grove_meta SET schema_version=99 WHERE id=1',[],false);await c.close();return true;});assert.equal(c,true);future=true;await device?.close();device=undefined;adb('shell','am','force-stop',app);
  const originalDb=execFileSync(path.join(sdk,'platform-tools/adb'),['-s',serial,'exec-out','run-as',app,'cat','databases/mandarin_groveSQLite.db']);fs.writeFileSync(path.join(output,'future-schema-original.db'),originalDb);await connect(false);assert.match(await page.locator('#app').innerText(),/newer or unsupported schema/);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);
  await page.getByRole('button',{name:'Download recovery copy',exact:true}).click();const requested=ui('future-request'),recoveryName=requested.find(n=>n['resource-id']==='android:id/title'&&n['class']==='android.widget.EditText').text;assert.match(recoveryName,/^mandarin-grove-recovery-.*[.]json$/);tap('save-future',{'resource-id':'android:id/button1',text:'SAVE'});await page.waitForFunction(()=>document.getElementById('recovery-file-status').textContent.startsWith('Recovery file saved.'));const recovered=JSON.parse(fileBytes(recoveryName).toString('utf8'));assert.equal(recovered.format,'mandarin-grove-native-files-v1');assert.ok(recovered.files.length);for(const f of recovered.files){assert.match(f.name,/^mandarin_groveSQLite\.db(?:-wal|-shm)?$/);assert.equal(hash(Buffer.from(f.base64,'base64')),f.sha256);}assert.equal(recovered.files.find(f=>f.name==='mandarin_groveSQLite.db').sha256,hash(originalDb));fs.writeFileSync(path.join(output,'future-schema-os-recovery.json'),JSON.stringify(recovered));receipt.checks.push('Future schema fails closed; actual recovery button/picker exports byte-identical original DB with SHA-256 and no installation identity');
  await restart(false);await repairSyntheticFault();future=false;await restart();assert.equal(await page.evaluate(()=>GrovePlatform.installationId),id);assert.equal((await page.evaluate(()=>GROVE_REPOSITORY.peekProfile('synthetic-a'))).stars,practiced.after);receipt.passed=true;console.log('PASS actual Android document picker import/export/cancel/UTF-8, offline recovery chain, private identity and future-schema raw recovery');
 }finally{
  if(future&&page){try{await restart(false);await repairSyntheticFault();receipt.artificialSchemaMarkerRestored=true;}catch(error){receipt.teardownError=String(error);}}
  await device?.close();fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
