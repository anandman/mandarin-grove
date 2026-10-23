const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});try{
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.APP_URL||'http://127.0.0.1:4194');
const palettes=await page.evaluate(async()=>{
 const data=await fetch('strokes/林.json').then(r=>r.json());const box=document.createElement('div');box.style.cssText='width:300px;height:300px';document.body.append(box);setAppearance('light');
 const guide=WritingSurface.create(box,'林',{charDataLoader:(_,done)=>done(data)});await guide.getCharacterData();
 const paths=()=>[...box.querySelectorAll('path[stroke]')].slice(data.strokes.length,data.strokes.length*2).map(p=>p.getAttribute('stroke'));
 const results=[];for(const mode of ['dark','light']){setAppearance(mode);await new Promise(r=>setTimeout(r,30));results.push(paths());}box.remove();return results;
});
for(const paths of palettes){assert.equal(paths.length,8);assert.equal(new Set(paths).size,1,'Every main radical stroke follows the same current ink');}
await page.evaluate(async()=>{const box=document.createElement('div');box.style.cssText='width:300px;height:300px';document.body.append(box);const w=WritingSurface.create(box,'十',{charDataLoader:(_,done,fail)=>fail(Error('Synthetic guide failure')),onLoadCharDataError:()=>{}});await w.getCharacterData();setAppearance('dark');await new Promise(r=>setTimeout(r,30));box.remove();});assert.deepEqual(errors,[],'Failed guides cannot break later theme updates');
console.log('PASS: actual radical/main paths follow both themes, guide failure does not throw on theme changes.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
