// Real app error presentation; only the failed OS file operation is doubled.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH}),failed=[];try{
 const origin=process.env.APP_URL||'http://127.0.0.1:4173';
 async function run(name,fn){const context=await b.newContext({viewport:{width:320,height:568}});await context.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())&&new URL(r.request().url()).origin===new URL(origin).origin?r.continue():r.abort());const p=await context.newPage();p.setDefaultTimeout(8000);try{await p.goto(origin);await p.evaluate(()=>GROVE_STARTED);await p.evaluate(async()=>{PR={cur:'failure-qa',list:[{id:'failure-qa',name:'QA',gr:'2',av:'🐼'}]};await savePR();await loadS();S.cfg.set=['学'];S.future={keep:true};await save();window.say=()=>{};await home();window.failureBackup=await backup();});await fn(p);console.log('PASS:',name);}catch(e){failed.push(name);console.error('FAIL:',name,e.message);}finally{await context.close();}}
 async function usable(p,locator){const r=await locator.evaluate(el=>{const r=el.getBoundingClientRect(),v=visualViewport,h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);let clipped=false;for(let a=el.parentElement;a;a=a.parentElement){const c=getComputedStyle(a),b=a.getBoundingClientRect();if(/hidden|auto|scroll|clip/.test(c.overflowY)&&(r.top<b.top-1||r.bottom>b.bottom+1))clipped=true;}return {visible:el.checkVisibility(),inside:r.y>=0&&r.bottom<=(v?.height||innerHeight)&&r.x>=0&&r.right<=innerWidth,hit:!!h&&(el===h||el.contains(h)),clipped};});assert.deepEqual(r,{visible:true,inside:true,hit:true,clipped:false});}
 await run('failed writing guide keeps Retry fully reachable',async p=>{await p.route('**/strokes/**',r=>r.abort());await p.evaluate(()=>trace());const retry=p.getByRole('button',{name:'Retry writing guide',exact:true});await retry.waitFor();await usable(p,retry);assert.equal(await p.evaluate(()=>backup()),await p.evaluate(()=>failureBackup));});
 await run('current-backup failure is visible while preview stays open',async p=>{await p.evaluate(async()=>{window.GrovePlatform={...GrovePlatform,files:{async saveText(){throw Error('Synthetic file permission denied');}}};await grown('backup');});await p.locator('#grest').click();await p.locator('#grt').fill(await p.evaluate(()=>failureBackup));await p.locator('#grr').waitFor();await p.getByRole('button',{name:'Download current backup first',exact:true}).click();await p.waitForFunction(()=>document.getElementById('backup-status').textContent.includes('Synthetic file permission denied'));await usable(p,p.locator('#backup-status'));await usable(p,p.locator('#grc'));assert.equal(await p.evaluate(()=>backup()),await p.evaluate(()=>failureBackup));});
 await run('task-origin recovery pins actions around long error information',async p=>{await p.evaluate(()=>{showSummaryHelp();showProgressRecovery(Error('Synthetic recovery diagnostic. '.repeat(40)),{imported:true});});await usable(p,p.getByRole('button',{name:'Download recovery copy',exact:true}));await usable(p,p.getByRole('button',{name:'Reload',exact:true}));assert.equal(await p.evaluate(()=>backup()),await p.evaluate(()=>failureBackup));});
 await run('feedback keeps close and commit around expanded information',async p=>{
  await p.setViewportSize({width:360,height:400});
  await p.evaluate(async()=>{await showFeedback({category:'broken',note:'Synthetic layout only; do not send.'});document.getElementById('feedback-manual').open=true;document.getElementById('feedback-details').open=true;document.getElementById('feedback-pending').hidden=false;document.getElementById('feedback-status').textContent='Synthetic retained status. '.repeat(20);});
  await p.locator('#feedback-note').focus();
  const content=p.locator('.feedback-frame-information');await content.evaluate(e=>e.scrollTop=e.scrollHeight);
  await usable(p,p.getByRole('button',{name:'Close feedback',exact:true}));await usable(p,p.locator('#feedback-send'));
  assert.equal(await p.evaluate(()=>backup()),await p.evaluate(()=>failureBackup));
 });
 await run('short stale preview and long failed restore keep actions reachable',async p=>{
  await p.evaluate(async()=>{await grown('backup');});await p.locator('#grest').click();await p.locator('#grt').fill(await p.evaluate(()=>failureBackup));await p.locator('#grr').waitFor();
  await p.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('zh_p_failure-qa'));saved.stars++;localStorage.setItem('zh_p_failure-qa',JSON.stringify(saved));});
  const current=await p.evaluate(()=>backup());await p.setViewportSize({width:844,height:390});await p.locator('#grr').click();
  await usable(p,p.getByRole('button',{name:'Refresh comparison',exact:true}));await usable(p,p.locator('#grc'));assert.equal(await p.evaluate(()=>backup()),current);
  await p.getByRole('button',{name:'Refresh comparison',exact:true}).click();await p.locator('#grr').waitFor();
  await p.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='zh_import_recovery_v1'){Storage.prototype.setItem=original;throw Error('Synthetic retained-file permission error. '.repeat(50));}return original.call(this,k,v);};});
  await p.locator('#grr').click();await p.waitForFunction(()=>document.getElementById('grpv').textContent.includes('Could not restore'));
  await usable(p,p.locator('#grc'));assert.ok(await p.locator('.restore-information').evaluate(e=>e.scrollHeight>e.clientHeight&&getComputedStyle(e).overflowY==='auto'));assert.equal(await p.evaluate(()=>backup()),current);
 });
 await run('actual synthetic import then load failure enters bounded recovery',async p=>{
  await p.evaluate(async()=>{showSummaryHelp();window.originalFailureRaw=localStorage.getItem('zh_p_failure-qa');await grown('backup');});await p.locator('#grest').click();await p.locator('#grt').fill(await p.evaluate(()=>failureBackup));await p.locator('#grr').waitFor();
  await p.evaluate(()=>{window.loadS=async()=>{throw Error('Synthetic post-import opening error. '.repeat(50));};});
  await p.locator('#grr').click();await p.getByRole('heading',{name:'Your backup was saved but could not be opened',exact:true}).waitFor();
  await usable(p,p.getByRole('button',{name:'Download recovery copy',exact:true}));await usable(p,p.getByRole('button',{name:'Reload',exact:true}));
  assert.equal(await p.evaluate(()=>localStorage.getItem('zh_p_failure-qa')),await p.evaluate(()=>originalFailureRaw));
 });
 assert.deepEqual(failed,[]);
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
