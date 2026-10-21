// Synthetic progress only: blocked clipboard, file transfer, and restore preview.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  const source=await browser.newContext({viewport:{width:390,height:740},acceptDownloads:true});
  const page=await source.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SOURCE_URL||'http://127.0.0.1:4173');
  const original=await page.evaluate(()=>{
   PR={cur:'transfer-a',list:[{id:'transfer-a',name:'练习 A',gr:'4',av:'🐳'},{id:'transfer-b',name:'练习 B',gr:'K',av:'🐼'}]};savePR();
   for(const p of PR.list){const state=blank();state.stars=p.gr==='4'?249:81;state.pts={一:7,子:6};state.cfg.set=['一','子'];state.cfg.cramUnits={'4':[1,3]};state.extra={preserve:true};localStorage.setItem('zh_p_'+p.id,JSON.stringify(state));}
   loadS();window.say=()=>{};home();
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new DOMException('Clipboard denied','NotAllowedError'))}});
   return backup();
  });
  await page.evaluate(()=>grown());await page.locator('#gcopy').click();
  const code=page.getByRole('textbox',{name:'Backup code',exact:true});await code.waitFor();
  assert.equal(await code.inputValue(),original);
  await page.getByRole('button',{name:'Select backup code',exact:true}).click();
  assert.deepEqual(await code.evaluate(t=>({start:t.selectionStart,end:t.selectionEnd,css:getComputedStyle(t).webkitUserSelect})),{start:0,end:original.length,css:'text'});
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download backup file',exact:true}).click();
  const download=await pending,path=await download.path();
  assert.match(download.suggestedFilename(),/^mandarin-grove-backup-\d{4}-\d\d-\d\d\.txt$/);
  const exported=await fs.readFile(path,'utf8');assert.equal(exported,original);
  assert.equal(await page.evaluate(()=>backup()),original,'Export leaves original progress unchanged');
  await page.screenshot({path:'/tmp/grove-backup-export-phone.png'});
  const destination=await browser.newContext({viewport:{width:820,height:1060}}),target=await destination.newPage();
  target.on('pageerror',e=>errors.push(e.message));
  await target.goto(process.env.APP_URL||'http://localhost:4173');
  await target.evaluate(()=>{PR={cur:'placeholder',list:[{id:'placeholder',name:'Temporary',gr:'2',av:'🐼'}]};savePR();loadS();window.say=()=>{};home();grown()});
  const before=await target.evaluate(()=>backup());
  await target.getByRole('button',{name:'Restore from backup file',exact:true}).click();
  await target.locator('#gfile').setInputFiles({name:download.suggestedFilename(),mimeType:'text/plain',buffer:Buffer.from(exported)});
  await target.locator('#grr').waitFor();
  assert.equal(await target.evaluate(()=>backup()),before,'Reading a file only previews, never overwrites progress');
  assert.match(await target.locator('#grpv').innerText(),/练习 A/);assert.match(await target.locator('#grpv').innerText(),/练习 B/);
  await target.screenshot({path:'/tmp/grove-backup-import-ipad.png'});
  await target.locator('#grr').click();
  const restored=await target.evaluate(()=>JSON.parse(decodeURIComponent(escape(atob(backup())))));
  const expected=JSON.parse(Buffer.from(original,'base64').toString('utf8'));
  assert.deepEqual(restored,expected,'File restore preserves both complete child snapshots');
  await target.evaluate(()=>grown());await target.getByRole('button',{name:'Restore from backup file',exact:true}).click();
  await target.locator('#gfile').setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('not a backup')});
  await target.getByText('That code did not work.',{exact:false}).waitFor();assert.equal(await target.locator('#grr').count(),0);
  assert.deepEqual(await target.evaluate(()=>JSON.parse(decodeURIComponent(escape(atob(backup()))))),expected,'Invalid files never replace saved progress');
  assert.deepEqual(errors,[]);
  console.log('PASS: denied clipboard retains selectable full code; download exports all original progress; file preview/restore preserves both profiles; invalid files do not overwrite anything.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
