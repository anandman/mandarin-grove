const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});try{
const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true}),errors=[],failures=[];page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.APP_URL||'http://127.0.0.1:4194');
await page.evaluate(()=>{PR={cur:'parent-a',list:[{id:'parent-a',name:'Synthetic A',gr:'2',av:'🐼'},{id:'parent-b',name:'Synthetic B',gr:'4',av:'🐳'}]};savePR();loadS();S=blank();S.stars=72;S.extra={preserve:true};S.cfg.set=['狗','猫','改'];save();setCards();say=()=>{};home();});
const baseline=await page.evaluate(()=>backup());
async function check(name,run){try{await run();console.log('PASS '+name);}catch(e){failures.push(name+': '+e.stack);}}
await check('School-first lookup keeps the full dictionary',async()=>{
 await page.evaluate(()=>showHomeworkLookup());await page.waitForFunction(()=>HELP_VOCABULARY_PACK&&HELP_DICTIONARY_SOURCE);await page.locator('#lookup-input').fill('改');await page.locator('#lookup-search').click();
 assert.deepEqual(await page.locator('#lookup-school-results [data-lookup-text]').evaluateAll(es=>es.slice(0,2).map(e=>e.dataset.lookupText)),['改','改正']);
 assert.equal(await page.locator('#lookup-dictionary').getAttribute('open'),null);await page.locator('#lookup-dictionary > summary').click();assert.ok(await page.locator('#lookup-dictionary-results [data-lookup-text="劳改"]').isVisible(),'Broad results still available explicitly');
 await page.locator('#lookup-school-results [data-lookup-text="改正"]').click();assert.match(await page.locator('#lookup-detail').innerText(),/teaching review pending/);assert.ok(await page.getByRole('button',{name:'Report this example',exact:true}).isVisible());
 assert.equal(await page.evaluate(()=>backup()),baseline);
});
await check('Grouped settings, persistent close and comparative backup preview',async()=>{
 await page.evaluate(()=>{home();grown();});const nav=page.getByRole('navigation',{name:'Grown-ups sections',exact:true});assert.ok(await nav.isVisible());assert.match(await page.locator('#child-save-note').innerText(),/Save/);
 await nav.getByRole('button',{name:'Backup',exact:true}).click();await page.locator('#grest').click();await page.locator('#grt').fill('invalid');assert.equal(await page.locator('#grr').count(),0);
 const fixture=JSON.parse(await fs.readFile('tests/fixtures/backups/grove-v1.json','utf8')),code=Buffer.from(JSON.stringify(fixture)).toString('base64');await page.locator('#grt').fill(code);
 assert.match(await page.locator('#backup-comparison').innerText(),/Current device.*2 children/s);assert.match(await page.locator('#backup-comparison').innerText(),/Synthetic A/);assert.match(await page.locator('#backup-comparison').innerText(),/This backup.*2 children/s);assert.match(await page.locator('#grr').innerText(),/Replace all device progress/);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download current backup first',exact:true}).click();const file=await pending;assert.equal(await fs.readFile(await file.path(),'utf8'),baseline,'Export-first saves current data, not incoming data');assert.equal(await page.evaluate(()=>backup()),baseline);
 const close=page.locator('#gov').getByRole('button',{name:'Close',exact:true});const bounds=await close.boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=844,'Close stays in view after backup scrolling');await page.locator('#grc').click();await page.keyboard.press('Escape');await page.locator('#gov').waitFor({state:'detached'});assert.equal(await page.locator('#gov').count(),0);assert.equal(await page.evaluate(()=>backup()),baseline);
});
await check('Progress leads to real next actions with distinct scheduling',async()=>{
 await page.evaluate(()=>{document.querySelectorAll('dialog').forEach(d=>d.remove());home();const c=ALL.find(c=>c.c==='狗');S.cfg.studyChoices={'2':{review:{units:[],chars:['狗'],modes:['flip'],limit:5}}};startStudyRound('review',S.cfg.studyChoices['2'].review,[c],[['flip',c]]);});await page.locator('#cd').click();await page.locator('#no').click();
 const history=await page.evaluate(()=>JSON.stringify(S.studyHistory));await page.evaluate(()=>{home();kidProgress();});assert.match(await page.locator('#progress-next').innerText(),/1\s+thing to practice/);assert.match(await page.locator('#progress-next').innerText(),/0\s+scheduled/);assert.equal(await page.locator('#progress-details').getAttribute('open'),null);
 await page.locator('#dash-needs').click();assert.equal(await page.locator('.recent-mistake-row').count(),1);assert.equal(await page.evaluate(()=>JSON.stringify(S.studyHistory)),history);await page.getByRole('button',{name:'Close things to practice',exact:true}).click();await page.getByRole('button',{name:'Close session choices',exact:true}).click();
 await page.evaluate(()=>parentDashboard('parent-b','4'));assert.equal(await page.evaluate(()=>PR.cur),'parent-a','Reading sibling progress cannot silently change the active child');
});
assert.deepEqual(errors,[]);if(failures.length)throw Error(failures.join('\n'));console.log('PASS: Help ranking/provenance, parent navigation, sticky Close, export-first preview/cancel and accurate progress actions preserve synthetic state.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
