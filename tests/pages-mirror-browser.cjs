const http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {exportStatic}=require('../scripts/export-static.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 let server,temp;
 if(!process.env.APP_URL){
  temp=fs.mkdtempSync(path.join(os.tmpdir(),'grove-pages-browser-'));const out=exportStatic(path.resolve(__dirname,'..'),path.join(temp,'site'),{feedback:'local'});
  server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/mandarin-grove\//,'')||'index.html',file=path.resolve(out,name);
   if(!file.startsWith(out+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
   const mime={'.js':'text/javascript','.json':'application/json','.html':'text/html','.css':'text/css','.webmanifest':'application/manifest+json','.txt':'text/plain','.png':'image/png'};res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 }
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}),base=process.env.APP_URL||'http://127.0.0.1:'+server.address().port+'/mandarin-grove/';
 try{
  const context=await browser.newContext(),page=await context.newPage(),errors=[],posts=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/api/feedback',r=>{posts.push(r.request().method());return r.abort();});
  await page.goto(base);await page.evaluate(()=>{PR={cur:'pages-synthetic',list:[{id:'pages-synthetic',name:'Synthetic',gr:'2',av:'🐼'}]};savePR();loadS();S.stars=77;S.opaque={preserve:'yes'};save();say=()=>{};home();});
  const before=await page.evaluate(()=>backup());
  await page.evaluate(()=>{document.documentElement.dataset.feedback='local';showFeedback({category:'broken',note:'Synthetic saved report'});});
  assert.equal(await page.locator('#feedback-send').isVisible(),false,'static mirror must not offer an unavailable server send');
  assert.equal(await page.locator('#feedback-save').isVisible(),true);await page.locator('#feedback-save').click();
  assert.equal((await page.evaluate(()=>feedbackReports()))[0].delivery.state,'local');assert.match(await page.locator('#feedback-status').innerText(),/Nothing has been sent/);
  await page.locator('#feedback-manual').click();const download=page.waitForEvent('download');await page.locator('#feedback-download').click();assert.equal((await download).suggestedFilename(),'mandarin-grove-feedback.txt');
  const result=await page.evaluate(()=>feedbackSendReport(feedbackReports()[0]));assert.equal(result.ok,false);assert.equal(posts.length,0,'even direct legacy retries never post on the static mirror');
  assert.equal(await page.evaluate(()=>backup()),before);await page.getByRole('button',{name:'Close feedback',exact:true}).click();
  console.log('PASS: Pages feedback saves/downloads locally and never posts or changes progress');
  await page.waitForFunction(()=>OFFLINE_STATUS==='ready',{},{timeout:45000});await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.evaluate(()=>{S.cfg.notLearned=[];S.cfg.studyChoices={2:{practice:{units:['2:1'],chars:['猫','狗'],modes:['trace'],limit:5}}};save();});
  const saved=await page.evaluate(()=>{const copy=JSON.parse(JSON.stringify(S));delete copy.readingStudy;return copy;});await context.setOffline(true);await page.reload();await page.evaluate(()=>{say=()=>{};showHomeworkLookup();});
  await page.locator('#lookup-bank-status[data-ready="true"]').waitFor();await page.locator('#lookup-input').fill('鑫');await page.locator('#lookup-search').click();await page.locator('[data-lookup-text="鑫"]').waitFor();
  await page.evaluate(()=>showStudySetup('practice'));await page.locator('#study-reading').click();await page.locator('[data-reading="grove-pets"]').click();await page.locator('#online-passages').waitFor();assert.match(await page.locator('#online-passages').innerText(),/小猫/);
  assert.deepEqual(await page.evaluate(()=>{const copy=JSON.parse(JSON.stringify(S));delete copy.readingStudy;return copy;}),saved);assert.ok(await page.evaluate(()=>GroveBackup.decodeBackup(backup(),GROVE_CODEC).rawProfiles[PR.cur].includes('readingStudy')));assert.deepEqual(errors,[]);await context.close();
  console.log('PASS: project-path cold reload, complete dictionary and selected reading work offline with backup unchanged');
 }finally{await browser.close();if(server)await new Promise(r=>server.close(r));if(temp)fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
