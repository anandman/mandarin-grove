const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),script=path.join(root,'scripts/export-mobile.cjs');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function exporter(){assert.ok(fs.existsSync(script),'Native allowlisted exporter must exist');return require(script).exportMobile;}
function destination(){return path.join(fs.mkdtempSync(path.join(os.tmpdir(),'grove-mobile-export-test-')),'www');}
test('mobile package contains every required sourced asset and excludes workspace/private data',()=>{
 const out=exporter()(root,destination()),catalog=JSON.parse(fs.readFileSync(path.join(root,'audio-sources/mainland.json')));
 for(const file of ['content/curriculum.js','vendor/cc-cedict/dictionary.json','strokes/府.json','vendor/hanzi-writer.js','audio-sources/LICENSE-MSU.txt','audio-sources/LICENSE.txt'])assert.equal(hash(path.join(out,file)),hash(path.join(root,file)),file);
 for(const row of Object.values(catalog.readings))assert.equal(hash(path.join(out,row.file)),row.sha256,row.file);
 for(const file of ['HANDOFF.md','docs/DEVELOPMENT.md','tests/profiles.test.cjs','.git/config','exports/private-datasets/msu-tone-perfect/originals/tone_perfect_all_mp3.zip','mobile/package-lock.json'])assert.equal(fs.existsSync(path.join(out,file)),false,file);
 assert.equal(hash(path.join(out,catalog.readings.fu3.file)),'dda17bab9e51cc5a7c027e2acf943fd636d30d3d72b1078e4a67ea992a435819');
});
test('native bootstrap precedes learner and preference code and cannot start the web updater',()=>{
 const out=exporter()(root,destination()),html=fs.readFileSync(path.join(out,'index.html'),'utf8');
 const scripts=[...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
 assert.equal(scripts[0],'native/bridge.js','Install native readiness before any browser defaults');
 for(const file of ['app.js','backups.js','theme.js'])assert.ok(scripts.includes(file),'Reuse '+file);
 for(const file of ['offline.js','version-check.js'])assert.equal(scripts.includes(file),false,file+' must not execute in an installed app');
 assert.match(html,/data-grove-native="true"/);assert.match(html,/data-native-persistence="sqlite"/);
 assert.equal(fs.readFileSync(path.join(out,'native/bridge.js'),'utf8').includes('GroveNativeTest'),false,'Ordinary packages contain no internal transaction controls');
 const config=require('../mobile/capacitor.config.json');assert.equal(config.appId,'io.github.anandman.mandaringrove');assert.equal(config.webDir,'www');assert.equal(config.server?.url,undefined);assert.equal(config.server?.cleartext,undefined);
});
test('native HTML without its bridge refuses readiness instead of opening browser storage',async()=>{
 const vm=require('node:vm'),context=vm.createContext({window:{},document:{documentElement:{dataset:{groveNative:'true'}}}});
 vm.runInContext(fs.readFileSync(path.join(root,'platform/runtime.js'),'utf8'),context);
 assert.notEqual(context.window.GrovePlatform.platform,'web');assert.equal(context.window.GrovePlatform.persistenceReady,false);
 await assert.rejects(context.window.GrovePlatform.ready(),/native|bridge|unavailable/i);
});
test('web export and source bytes remain identical after a mobile export',()=>{
 const {exportStatic}=require('../scripts/export-static.cjs');const before=hash(path.join(root,'index.html'));const first=exportStatic(root,destination());exporter()(root,destination());const second=exportStatic(root,destination());
 assert.equal(hash(path.join(root,'index.html')),before);assert.equal(hash(path.join(first,'index.html')),hash(path.join(second,'index.html')));assert.match(fs.readFileSync(path.join(second,'index.html'),'utf8'),/src="offline.js/);
});
test('export refuses an existing arbitrary output and cannot overwrite source',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'grove-mobile-preserve-')),sentinel=path.join(dir,'keep.txt');fs.writeFileSync(sentinel,'preserve');
 assert.throws(()=>exporter()(root,dir),/existing|replace|overwrite/i);assert.equal(fs.readFileSync(sentinel,'utf8'),'preserve');assert.throws(()=>exporter()(root,root),/source|workspace|output/i);
});

test('native extensionless-license aliases preserve exact source bytes and originals',()=>{
 const out=exporter()(root,destination());
 for(const [source,alias]of [['vendor/cc-cedict/LICENSE','native/notices/cc-cedict.txt'],['vendor/writing-spark/LICENSE','native/notices/writing-spark.txt']]){assert.equal(hash(path.join(out,alias)),hash(path.join(root,source)));assert.equal(hash(path.join(out,source)),hash(path.join(root,source)));}
});
