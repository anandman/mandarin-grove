const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname,'..');
const shell = fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.doesNotMatch(shell,/\son[a-z]+\s*=/i,'The shell delegates events to runtime listeners');
assert.doesNotMatch(shell,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i,'The shell permits browser zoom');
const scripts=[...shell.matchAll(/<script[^>]+src="([^"?]+)/g)].map(match=>match[1]);
for(const file of ['content/curriculum.js','core/units.js','core/catalog.js','core/results.js','activities.js']) {
  assert.ok(scripts.includes(file),file+' is linked');
  assert.ok(scripts.indexOf(file)<scripts.indexOf('app.js'),file+' precedes app bootstrap');
}
assert.ok(scripts.indexOf('core/state.js')<scripts.indexOf('adapters/web-storage.js'));
assert.ok(scripts.indexOf('practice.js')<scripts.indexOf('activities.js'));

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  try {
    const page=await browser.newPage();
    // Layout-only scaffold: runtime scripts deliberately return empty bodies. The live app
    // must be checked after root integrates the independent runtime and curriculum modules.
    await page.route('http://grove.test/**',async route=>{
      const file=new URL(route.request().url()).pathname.slice(1)||'index.html';
      if(file.endsWith('.js'))return route.fulfill({contentType:'application/javascript',body:''});
      if(['index.html','styles.css','theme.css','icon64.png'].includes(file))return route.fulfill({body:fs.readFileSync(path.join(root,file)),contentType:file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
      return route.fulfill({status:404,body:''});
    });
    await page.goto('http://grove.test/');
    for(const id of ['totop','ttl','home','hd','reward-strip','speech-status','app','report-problem'])assert.equal(await page.locator('#'+id).count(),1,id+' remains unique');
    await page.evaluate(()=>{
      document.getElementById('hd').innerHTML='<button class="pill" type="button"><span class="nm">Learner</span><span class="gb">4th</span></button><button id="gear" type="button" aria-label="Grown-ups">⚙</button>';
      const strip=document.getElementById('reward-strip');strip.hidden=false;
      strip.innerHTML='<button class="reward-collection-link">🎗️ 2<span>My badges</span></button><button class="reward-collection-link grove-wallet-link">🍊 14<span>Your grove</span></button><div class="reward-meter"><span>2/10 steps</span><progress max="10" value="2"></progress></div>';
    });
    const fixtures={
      writing:'<h1>Trace</h1><div class="hwgrid"><div id="hw"><svg viewBox="0 0 300 300" aria-label="Writing guide"><path d="M80 80L220 220" stroke="currentColor"/></svg></div><canvas id="hwc" width="300" height="300" aria-label="Writing paper"></canvas></div><p class="mean">Follow the strokes</p><button class="btn" type="button">Next</button>',
      listening:'<h1>Listen &amp; Tap</h1><div class="choices">'+['狗','猫','女','祖'].map(c=>'<button class="opt" type="button">'+c+'</button>').join('')+'</div>',
      settings:'<h1>Profiles and settings</h1><label>Name <input aria-label="Name" value="Learner"></label><label>Voice <select aria-label="Voice"><option>Automatic Mandarin voice</option></select></label><div class="grg"><button type="button" aria-pressed="true"><b>2</b><span>Grade 2</span></button></div><button class="btn gray sm" type="button">Save</button><button class="chip" type="button" aria-pressed="true">Unit 1</button>',
      characters:'<h1>My characters</h1><div class="sets"><section class="set open"><button type="button" aria-expanded="true"><span class="tt">Unit 1</span><span class="st">2 characters</span><span class="cv">⌄</span></button><div class="zoo">'+['狗','猫'].map(c=>'<button class="z character-tile" type="button"><span class="ch">'+c+'</span><span class="py">pinyin</span><span class="dots"><i class="on"></i><i></i></span></button>').join('')+'</div></section></div>',
      detail:'<h1>Character details</h1><article class="card"><div class="big">狗</div><div class="pin">gǒu</div><p class="mean">dog</p></article><button class="btn gray" type="button">Close</button>'
    };
    for(const width of [390,820,1280])for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:1060});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      for(const [name,markup]of Object.entries(fixtures)){
        await page.locator('#app').evaluate((app,markup)=>app.innerHTML=markup,markup);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,name+' fits '+width+' '+theme);
        if(name==='writing')for(const id of ['hw','hwc']){const box=await page.locator('#'+id).boundingBox();assert.ok(box.width>=250&&box.width<=420,id+' retains usable writing width');assert.ok(Math.abs(box.width-box.height)<2,id+' stays square');}
        if(name==='settings')assert.ok(await page.locator('input').evaluate(input=>parseFloat(getComputedStyle(input).fontSize)>=16),'Text input avoids mobile focus zoom');
        if(name==='listening')await page.locator('.opt').first().evaluate(button=>{button.focus();});
      }
      await page.locator('#report-problem').focus();
      assert.ok(await page.locator('#report-problem').evaluate(button=>getComputedStyle(button).outlineStyle!=='none'),'Keyboard focus is visible');
    }
    console.log('PASS: fresh shell IDs/dependencies/listeners, zoom, token themes, input sizing, handwriting squares and no overflow at390/820/1280. Runtime integration intentionally excluded.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
