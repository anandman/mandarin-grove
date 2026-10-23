// Synthetic snapshots only, in fresh disposable browser contexts.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const directory=path.join(__dirname,'fixtures/backups');
function preserves(actual,expected,label){
 if(expected&&typeof expected==='object'&&!Array.isArray(expected)){
  assert.ok(actual&&typeof actual==='object'&&!Array.isArray(actual),label);
  for(const [key,value] of Object.entries(expected))preserves(actual[key],value,label+'.'+key);
 }else assert.deepEqual(actual,expected,label);
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  for(const name of ['original-v1.json','grove-v1.json']){
   const context=await browser.newContext({viewport:{width:820,height:1060}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(process.env.APP_URL||'http://127.0.0.1:4173');
   await page.waitForFunction(()=>typeof backup==='function'&&typeof renderRewards==='function');
   await page.evaluate(()=>{
    window.say=()=>{};window.PF=()=>{};
    PR={cur:'placeholder',list:[{id:'placeholder',name:'Synthetic placeholder',gr:'2',av:'🐼'}]};savePR();loadS();home();
    localStorage.setItem('zh_voice','synthetic-explicit-voice');localStorage.setItem('zh_appearance','dark');
   });
   const snapshot=JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
   const code=Buffer.from(JSON.stringify(snapshot),'utf8').toString('base64');
   const restore=async value=>{
    await page.evaluate(()=>grown());await page.locator('#grest').click();
    await page.locator('#grt').fill(value);await page.locator('#grr').click();
   };
   await restore(code);
   assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(PR))),snapshot.PR,'Full registry, initial current profile and unknown fields survive import');
   for(const profile of snapshot.PR.list){
    await page.evaluate(id=>{PR.cur=id;savePR();loadS();home();},profile.id);
    const actual=await page.evaluate(()=>JSON.parse(JSON.stringify(S))),expected=JSON.parse(snapshot.data[profile.id]);
    preserves(actual,expected,name+'.'+profile.id);
    if(name==='grove-v1.json')assert.deepEqual(actual,expected,'Current snapshots need no lossy normalization or invented evidence');
    if(name==='original-v1.json')assert.equal(Object.keys(actual.learning?.chars||{}).length,0,'Legacy totals cannot create skill evidence');
   }
   const exported=await page.evaluate(()=>backup());
   const before=JSON.parse(Buffer.from(exported,'base64').toString('utf8'));
   await page.reload();await page.evaluate(()=>{window.say=()=>{};window.PF=()=>{};});
   await restore(exported);
   for(const profile of snapshot.PR.list)await page.evaluate(id=>{PR.cur=id;savePR();loadS();home();},profile.id);
   const after=JSON.parse(Buffer.from(await page.evaluate(()=>backup()),'base64').toString('utf8'));
   assert.deepEqual(after,before,'A second restore never credits rewards or rewrites history again');
   assert.deepEqual(after.PR.list,snapshot.PR.list,'Unknown profile fields and sibling metadata survive');
   assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('zh_voice'),localStorage.getItem('zh_appearance')]),['synthetic-explicit-voice','dark'],'Legacy restores retain explicit destination device choices');
   assert.deepEqual(errors,[],name+' browser errors');
   await context.close();
  }
  console.log('PASS: frozen original/current snapshots preserve both profiles, opaque fields, earned history, settings, drafts and sessions through UI restore, reload and repeated round trips.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
