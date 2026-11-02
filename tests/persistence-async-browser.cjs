// Fresh synthetic browser context. No live feedback or real learner storage.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  // Use a same-origin blank document so the live learner bootstrap cannot run.
  await page.goto(new URL('manifest.webmanifest',process.env.APP_URL||'http://127.0.0.1:4173/').href);
  await page.setContent('<!doctype html><html><body><p id="status">Waiting for durable save</p></body></html>');
  for(const file of ['core/state.js','core/backup.js','adapters/web-storage.js','adapters/persistence.js'])await page.addScriptTag({content:fs.readFileSync(file,'utf8')});
  const fixture=JSON.parse(fs.readFileSync('tests/fixtures/backups/original-v1.json','utf8'));
  const result=await page.evaluate(async original=>{
   const codec={decodeUtf8:code=>new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(code),c=>c.charCodeAt(0))),encodeUtf8:text=>{let bytes='';for(const byte of new TextEncoder().encode(text))bytes+=String.fromCharCode(byte);return btoa(bytes);}};
   localStorage.setItem('zh_profiles',JSON.stringify(original.PR));for(const [id,raw]of Object.entries(original.data))localStorage.setItem('zh_p_'+id,raw);
   localStorage.setItem('zh_voice','voice:synthetic');localStorage.setItem('other-site-data','keep');
   const source=GroveStorage.createRepository({storage:localStorage,codec}),repository=GrovePersistence.createRepository({repository:source});
   const registry=await repository.readRegistry(),owner=registry.cur,profile=await repository.readProfile(owner),before=localStorage.getItem('zh_p_'+owner);
   let release;const gate=new Promise(resolve=>release=resolve),deferred=GrovePersistence.createRepository({ready:()=>gate,repository:source});
   profile.stars=160;const committing=deferred.saveProfile(owner,profile,{expectedRevision:before}).then(saved=>{document.getElementById('status').textContent='Durable save acknowledged';return saved;});
   profile.stars=999;await new Promise(resolve=>setTimeout(resolve,0));
   const pending={status:document.getElementById('status').textContent,raw:localStorage.getItem('zh_p_'+owner)};release();const saved=await committing;
   const exported=JSON.parse(codec.decodeUtf8(await repository.exportBackup())),comparison=await repository.backupSummary();
   await Promise.all([repository.saveReport({id:'first',delivery:{state:'pending'}}),repository.saveReport({id:'second',delivery:{state:'local'}})]);
   await repository.writePreference('zh_appearance','dark');
   const unchangedBackup=await repository.exportBackup();
   const remote=JSON.parse(localStorage.getItem('zh_p_'+owner));remote.stars=161;localStorage.setItem('zh_p_'+owner,JSON.stringify(remote));
   let staleRejected=false;try{await repository.importBackup(codec.encodeUtf8(JSON.stringify(original)),{expectedStamp:comparison.stamp});}catch(error){staleRejected=/changed/i.test(error.message);}
   const recovery=await repository.exportRecovery();
   return {pending,before,savedStars:saved.stars,acknowledged:document.getElementById('status').textContent,exported,afterSettings:JSON.parse(codec.decodeUtf8(unchangedBackup)),reports:await repository.readReports(),staleRejected,latestStars:JSON.parse(localStorage.getItem('zh_p_'+owner)).stars,recoveryFormat:recovery.format,recoveryVoice:recovery.storage.zh_voice,recoveryUnrelated:recovery.storage['other-site-data']};
  },fixture);
  assert.equal(result.pending.status,'Waiting for durable save');assert.equal(result.pending.raw,result.before);assert.equal(result.savedStars,160);assert.equal(result.acknowledged,'Durable save acknowledged');
  assert.equal(JSON.parse(result.exported.data[fixture.PR.cur]).stars,160);assert.equal(result.exported.data['synthetic-b'],fixture.data['synthetic-b']);assert.deepEqual(result.exported.PR,fixture.PR);
  assert.deepEqual(result.afterSettings,result.exported);assert.deepEqual(result.reports.map(row=>row.id),['first','second']);assert.equal(result.staleRejected,true);assert.equal(result.latestStars,161);
  assert.equal(result.recoveryFormat,'mandarin-grove-recovery-v1');assert.equal(result.recoveryVoice,'voice:synthetic');assert.equal(result.recoveryUnrelated,undefined);assert.deepEqual(errors,[]);
  console.log('PASS: real Chrome storage waits for readiness, captures exact candidate, preserves inactive child/backup, separates settings/reports, and refuses stale replacement. App caller conversion is not covered by this boundary smoke.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
