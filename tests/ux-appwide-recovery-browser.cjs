const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}),failures=[];
async function run(name,fn){const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));try{
await page.goto(process.env.APP_URL||'http://127.0.0.1:4196');await page.evaluate(()=>{PR={cur:'recover-a',list:[{id:'recover-a',name:'Synthetic A',gr:'2',av:'🐼'},{id:'recover-b',name:'Synthetic B',gr:'4',av:'🐳'}]};savePR();loadS();S.stars=73;S.pts={狗:6};S.opaque={keep:['unrecognized']};save();say=()=>{};home();window.failNextStorage=key=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key){Storage.prototype.setItem=original;throw new DOMException('Synthetic full storage','QuotaExceededError');}return original.call(this,k,v);};};});await fn(page);assert.deepEqual(errors,[]);console.log('PASS:',name);}catch(e){failures.push(name);console.error('FAIL:',name,e.message);}finally{await page.close();}}
try{
await run('failed reset restores retained state before any later save',async p=>{
const before=await p.evaluate(()=>backup());await p.evaluate(()=>{grown('maintenance');failNextStorage('zh_p_recover-a');});p.once('dialog',d=>d.accept());await p.locator('#grk').click();
assert.equal(await p.evaluate(()=>S.stars),73,'Failed reset must not leave a blank in-memory profile');assert.equal(await p.evaluate(()=>backup()),before);
await p.evaluate(()=>{S.streak++;save();});const data=await p.evaluate(()=>JSON.parse(localStorage.getItem('zh_p_recover-a')));assert.equal(data.stars,73);assert.deepEqual(data.opaque,{keep:['unrecognized']});
});
await run('failed writing claim is retryable and earns once after persistence',async p=>{
await p.evaluate(()=>showWritingIdeas());await p.locator('#writing-input').fill('雨');await p.locator('#writing-generate').click();const before=await p.evaluate(()=>backup()),balance=await p.evaluate(()=>groveWallet(S).balance);await p.evaluate(()=>failNextStorage('zh_p_recover-a'));await p.locator('#writing-finish').click();
assert.equal(await p.evaluate(()=>groveWallet(S).balance),balance,'Failed reward write rolls back optimistic wallet');assert.equal(await p.evaluate(()=>writingIdeasSession().claim.done),false);assert.equal(await p.evaluate(()=>backup()),before);assert.ok(await p.locator('#writing-finish').isEnabled());assert.match(await p.locator('#writing-status').innerText(),/not save|could not|couldn.t/i);
await p.locator('#writing-finish').click();assert.equal(await p.evaluate(()=>groveWallet(S).balance),balance+1);assert.ok(await p.locator('#writing-finish').isDisabled());await p.reload();assert.equal(await p.evaluate(()=>groveWallet(S).balance),balance+1);
});
await run('appearance failure tells the truth and success clears error',async p=>{
await p.evaluate(()=>{grown('device');failNextStorage('zh_appearance');});await p.locator('#appearance-setting').selectOption('light');assert.match(await p.locator('#appearance-status').innerText(),/could not save/i);await p.locator('#appearance-setting').selectOption('dark');assert.match(await p.locator('#appearance-status').innerText(),/Saved/i);assert.doesNotMatch(await p.locator('#appearance-status').innerText(),/could not/i);
});
await run('voice preference failure restores stored choice without page error',async p=>{
await p.evaluate(()=>{localStorage.setItem('zh_voice','auto');grown('device');failNextStorage('zh_voice');});await p.locator('#voice-choice').selectOption('recorded');assert.equal(await p.locator('#voice-choice').inputValue(),'auto');assert.match(await p.locator('#voice-save-status').innerText(),/could not save/i);assert.equal(await p.evaluate(()=>localStorage.getItem('zh_voice')),'auto');
});
await run('download preparation failure has visible retryable status',async p=>{
await p.evaluate(()=>{grown('backup');localStorage.setItem('zh_p_recover-b','broken synthetic JSON');});await p.locator('#gdownload').click();assert.match(await p.locator('#backup-status').innerText(),/could not prepare/i);assert.ok(await p.locator('#backup-status').evaluate(el=>el===document.activeElement));
});
const code=Buffer.from(fs.readFileSync('tests/fixtures/backups/grove-v1.json','utf8')).toString('base64');
await run('stale comparison focuses a visible recovery action',async p=>{
await p.evaluate(()=>grown('backup'));await p.locator('#grest').click();await p.locator('#grt').fill(code);await p.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('zh_p_recover-a'));saved.stars++;localStorage.setItem('zh_p_recover-a',JSON.stringify(saved));});await p.locator('#grr').click();const refresh=p.getByRole('button',{name:'Refresh comparison',exact:true});assert.ok(await refresh.evaluate(el=>{const r=el.getBoundingClientRect(),h=document.querySelector('#gov>header').getBoundingClientRect();return r.top>=h.bottom&&r.bottom<=innerHeight;}),'Focused action must be below sticky header');
});
await run('failed import reveals and focuses error without changing backup',async p=>{
await p.evaluate(()=>grown('backup'));await p.locator('#grest').click();await p.locator('#grt').fill(code);const before=await p.evaluate(()=>backup());
await p.evaluate(()=>{const orig=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='zh_import_recovery_v1'){Storage.prototype.setItem=orig;throw new DOMException('Synthetic full','QuotaExceededError');}return orig.call(this,k,v);};});await p.locator('#grr').click();assert.equal(await p.evaluate(()=>backup()),before);assert.ok(await p.locator('#grpv').evaluate(el=>el.contains(document.activeElement)));assert.match(await p.locator('#grpv').innerText(),/Could not restore/);
});
}finally{await browser.close();}assert.deepEqual(failures,[]);})().catch(e=>{console.error(e);process.exit(1)});
