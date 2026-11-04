// Real installed SDK, separate synthetic journal database; never reset app data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{DatabaseSync}=require('node:sqlite');
const {_android}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.GROVE_NATIVE_EVIDENCE,sdk=process.env.ANDROID_HOME,serial=process.env.GROVE_ANDROID_SERIAL,app='io.github.anandman.mandaringrove';
assert.ok(output&&sdk&&serial);const adb=(...args)=>execFileSync(path.join(sdk,'platform-tools/adb'),['-s',serial,...args],{encoding:'utf8'}).trim();
(async()=>{fs.mkdirSync(output,{recursive:false});let device;try{
 assert.match(adb('emu','avd','name'),/^Grove_API36_Play/);adb('shell','cmd','connectivity','airplane-mode','enable');adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');assert.equal(adb('shell','settings','get','global','airplane_mode_on'),'1');
 adb('shell','am','start','-W','-n',app+'/.MainActivity');device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);assert.ok(device);const page=await(await device.webView({pkg:app})).page();page.setDefaultTimeout(30000);await page.waitForFunction(()=>GrovePlatform.persistenceReady&&typeof GROVE_STARTED!=='undefined');await page.evaluate(()=>GROVE_STARTED);await page.evaluate(fs.readFileSync(path.join(__dirname,'fixtures/native-journal-scenarios.js'),'utf8'));
 const receipt=await page.evaluate(()=>GroveNativeJournal());assert.equal(receipt.passed,true);receipt.platform='android';receipt.airplaneMode=true;fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 const files=adb('shell','run-as',app,'ls','databases').split(/\s+/).filter(n=>n.startsWith(receipt.name+'SQLite.db'));assert.ok(files.some(n=>n.endsWith('.db')));
 for(const n of files)fs.writeFileSync(path.join(output,n),execFileSync(path.join(sdk,'platform-tools/adb'),['-s',serial,'exec-out','run-as',app,'cat','databases/'+n]));
 for(const n of files)assert.equal(fs.readFileSync(path.join(output,n)).includes(Buffer.from(receipt.marker)),false,'No journal marker in actual DB/WAL after erase');
 const db=new DatabaseSync(path.join(output,receipt.name+'SQLite.db'),{readOnly:true});try{for(const table of ['grove_entries','grove_originals','grove_outbox','grove_sync_operations','grove_sync_states','grove_sync_batches'])assert.equal(db.prepare('SELECT count(*) AS n FROM '+table).get().n,0);assert.equal(db.prepare('SELECT namespace FROM grove_sync_binding').get().namespace,null);}finally{db.close();}
 fs.writeFileSync(path.join(output,'physical-erasure.json'),JSON.stringify({passed:true,files,logicalRows:0})+'\n');console.log('PASS actual Android schema3 migration, journal atomic rollback/FULL/lost ACK/cursor/scope/physical erase; app progress retained');
 }finally{await device?.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
