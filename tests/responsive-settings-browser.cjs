// Preserve an in-flight backup preview and unsaved settings when changing panes.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});try{
 const context=await b.newContext({viewport:{width:360,height:640}});await context.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
 const p=await context.newPage();await p.goto(process.env.APP_URL||'http://127.0.0.1:4173');await p.evaluate(()=>GROVE_STARTED);
 await p.evaluate(async()=>{PR={cur:'settings-qa',list:[{id:'settings-qa',name:'Settings QA',gr:'2',av:'🐼'}],unknown:{keep:true}};await savePR();await loadS();S.unknown={preserve:true};await save();window.say=()=>{};await home();window.originalSettingsBackup=await backup();await grown('backup');});
 await p.locator('#grest').click();await p.locator('#grt').fill(await p.evaluate(()=>originalSettingsBackup));await p.locator('#grr').waitFor();
 await p.locator('[data-settings-section="child"]').click();await p.locator('#gn').fill('Unsaved name stays');
 assert.ok(await p.locator('.settings-content').evaluate(e=>/auto|scroll/.test(getComputedStyle(e).overflowY)),'A retained hidden preview must not disable the selected form scroller');
 const scroller=p.locator('.settings-content');await scroller.hover();await p.mouse.wheel(0,1200);await p.waitForFunction(()=>document.querySelector('.settings-content').scrollTop>0);
 await p.locator('[data-settings-section="backup"]').click();assert.equal(await p.locator('#grt').inputValue(),await p.evaluate(()=>originalSettingsBackup));
 await p.locator('[data-settings-section="child"]').click();assert.equal(await p.locator('#gn').inputValue(),'Unsaved name stays');
 await p.locator('[data-settings-section="backup"]').click();await p.locator('#grc').click();assert.equal(await p.evaluate(()=>backup()),await p.evaluate(()=>originalSettingsBackup));
 await p.getByRole('button',{name:'Close',exact:true}).click();
 // A new device can open Grown-ups before any learner exists.
 await p.evaluate(async()=>{PR={cur:null,list:[]};await savePR();await grown();});
 const selected=await p.locator('.settings-content > section').evaluateAll(nodes=>nodes.filter(n=>!n.hidden).map(n=>n.id));
 assert.deepEqual(selected,['device-settings'],'A new device defaults to its applicable Device pane');
 assert.equal(await p.locator('[data-settings-section="device"]').getAttribute('aria-pressed'),'true');
 console.log('PASS: preview/unsaved-name retention, scrolling after pane change, exact unchanged backup and no-learner settings default.');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
