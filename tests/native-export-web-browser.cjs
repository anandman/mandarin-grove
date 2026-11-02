// Native-produced synthetic files → actual isolated web backup UI.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const inputs=process.env.GROVE_NATIVE_BACKUP_FILES?.split(path.delimiter).filter(Boolean);assert.ok(inputs?.length,'Explicit native synthetic export files required');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
  for(const input of inputs){
   const bytes=fs.readFileSync(input),expected=JSON.parse(Buffer.from(bytes.toString('utf8').replace(/\s/g,''),'base64').toString('utf8'));
   assert.ok(expected.PR.list.every(p=>p.id.startsWith('synthetic-')),'Synthetic exports only');const context=await browser.newContext({viewport:{width:820,height:1060},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(process.env.APP_URL||'http://127.0.0.1:4263');await page.evaluate(async()=>{await GROVE_STARTED;await GROVE_REPOSITORY.createProfile({name:'Synthetic destination',gr:'2',av:'🐼'});PR=await GROVE_REPOSITORY.readRegistry();await loadS({persist:false});await home();await grown();});
    const before=await page.evaluate(()=>backup());await page.getByRole('button',{name:'Restore from backup file',exact:true}).click();await page.locator('#gfile').setInputFiles({name:path.basename(input),mimeType:'text/plain',buffer:bytes});await page.locator('#grr').waitFor();assert.equal(await page.evaluate(()=>backup()),before,'File preview never writes destination progress');
    await page.locator('#grr').click();await page.waitForFunction(()=>!document.getElementById('grr'));const actual=JSON.parse(Buffer.from(await page.evaluate(()=>backup()),'base64').toString('utf8'));assert.deepEqual(actual,expected,'Every raw child, unknown field, reward and envelope survives native-to-web transfer');assert.equal(await page.evaluate(()=>GrovePlatform.platform),'web');assert.deepEqual(errors,[]);
    console.log('PASS native file → isolated web UI:',path.basename(input),'sha256='+crypto.createHash('sha256').update(bytes).digest('hex'));
   }finally{await context.close();}
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
