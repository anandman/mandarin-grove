const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const api=()=>require('../scripts/release.cjs'),root=path.resolve(__dirname,'..');
function git(dir,args){return cp.execFileSync('git',['-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false','-c','user.name=Grove fixture','-c','user.email=fixture@example.invalid','-C',dir,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function fixture(withGit=true){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'grove-provenance-'));
 fs.writeFileSync(path.join(dir,'release.json'),JSON.stringify({version:'1.0.100',build:100,futurePrivate:'DO NOT COPY THIS'}));fs.writeFileSync(path.join(dir,'app.js'),'/* original */');fs.writeFileSync(path.join(dir,'.gitignore'),'private-notes/\n');
 if(withGit){git(dir,['init','--quiet']);git(dir,['add','.']);git(dir,['commit','--quiet','-m','fixture']);}
 return dir;
}
test('provenance identifies actual clean source without time, machine paths or unknown config fields',()=>{
 const dir=fixture(),commit=git(dir,['rev-parse','HEAD']);assert.deepEqual(api().buildInfo(dir,{env:{},requireCleanSource:true}),{version:'1.0.100',build:100,sourceCommit:commit,sourceDirty:false});
});
test('tracked or untracked source blocks production, while ignored private research does not',()=>{
 const dir=fixture();fs.mkdirSync(path.join(dir,'private-notes'));fs.writeFileSync(path.join(dir,'private-notes','keep.txt'),'private');assert.equal(api().buildInfo(dir,{env:{},requireCleanSource:true}).sourceDirty,false);
 fs.writeFileSync(path.join(dir,'new-source.js'),'new');assert.throws(()=>api().buildInfo(dir,{env:{},requireCleanSource:true}),/dirty|uncommitted/i);assert.equal(api().buildInfo(dir,{env:{}}).sourceDirty,true);
 fs.unlinkSync(path.join(dir,'new-source.js'));fs.appendFileSync(path.join(dir,'app.js'),' changed');assert.throws(()=>api().buildInfo(dir,{env:{},requireCleanSource:true}),/dirty|uncommitted/i);
});
test('Git display configuration cannot hide untracked source from a release',()=>{
 const dir=fixture();git(dir,['config','status.showUntrackedFiles','no']);fs.writeFileSync(path.join(dir,'uncommitted.js'),'must not ship as committed source');assert.throws(()=>api().buildInfo(dir,{env:{},requireCleanSource:true}),/dirty|uncommitted/i);
});
test('provider commit metadata must agree with actual Git and with each other',()=>{
 const dir=fixture(),commit=git(dir,['rev-parse','HEAD']);assert.equal(api().buildInfo(dir,{env:{GITHUB_SHA:commit},requireCleanSource:true}).sourceCommit,commit);
 for(const env of [{GITHUB_SHA:'b'.repeat(40)},{VERCEL_GIT_COMMIT_SHA:'invalid'},{GITHUB_SHA:commit,VERCEL_GIT_COMMIT_SHA:'b'.repeat(40)}])assert.throws(()=>api().buildInfo(dir,{env,requireCleanSource:true}),/commit|identity|mismatch/i);
});
test('a trusted provider archive needs a full source commit; missing identity fails closed',()=>{
 const dir=fixture(false);assert.throws(()=>api().buildInfo(dir,{env:{},requireCleanSource:true}),/source|commit|identity/i);
 assert.deepEqual(api().buildInfo(dir,{env:{VERCEL_GIT_COMMIT_SHA:'a'.repeat(40)},requireCleanSource:true}),{version:'1.0.100',build:100,sourceCommit:'a'.repeat(40),sourceDirty:false});
});
test('a release tag cannot qualify the same version with different source',()=>{
 const dir=fixture();git(dir,['tag','v1.0.100']);fs.appendFileSync(path.join(dir,'app.js'),' other code');git(dir,['add','app.js']);git(dir,['commit','--quiet','-m','different source']);
 assert.throws(()=>api().buildInfo(dir,{env:{},requireCleanSource:true}),/tag|different.*commit|already.*source/i);
});
test('web and Pages exports record identical source metadata without native build prerequisites',()=>{
 const {exportStatic}=require('../scripts/export-static.cjs'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'grove-common-exports-'));
 const sites=[exportStatic(root,path.join(temp,'web')),exportStatic(root,path.join(temp,'pages'),{feedback:'local'})],texts=sites.map(site=>fs.readFileSync(path.join(site,'build-info.json'),'utf8'));
 assert.equal(texts[0],texts[1]);const info=JSON.parse(texts[0]),release=api().readRelease(root);assert.equal(info.version,release.version);assert.equal(info.build,release.build);assert.equal(info.sourceCommit,git(root,['rev-parse','HEAD']));assert.deepEqual(Object.keys(info).sort(),['build','sourceCommit','sourceDirty','version']);
 for(const site of sites){assert(JSON.parse(fs.readFileSync(path.join(site,'offline-assets.json'))).includes('build-info.json'));for(const name of ['HANDOFF.md','docs','release.json','.git'])assert.equal(fs.existsSync(path.join(site,name)),false);}
});
test('a rejected native CLI build leaves the previous generated package in place',()=>{
 const dir=fixture(),scripts=path.join(dir,'scripts');fs.mkdirSync(scripts);
 for(const name of ['release.cjs','export-static.cjs','export-mobile.cjs','native-text-style.cjs','static-files.json'])fs.copyFileSync(path.join(root,'scripts',name),path.join(scripts,name));
 fs.appendFileSync(path.join(dir,'.gitignore'),'mobile/www/\nmobile/dist/\nmobile/.build-history/\n');git(dir,['add','.']);git(dir,['commit','--quiet','-m','export tools']);
 fs.mkdirSync(path.join(dir,'mobile/www'),{recursive:true});fs.writeFileSync(path.join(dir,'mobile/www/keep.txt'),'previous package');fs.mkdirSync(path.join(dir,'mobile/dist'));fs.writeFileSync(path.join(dir,'mobile/dist/bridge.js'),'fixture bridge');fs.appendFileSync(path.join(dir,'app.js'),' changed');
 const env={...process.env};for(const name of ['GROVE_SOURCE_COMMIT','VERCEL_GIT_COMMIT_SHA','GITHUB_SHA'])delete env[name];const result=cp.spawnSync(process.execPath,[path.join(scripts,'export-mobile.cjs')],{cwd:dir,encoding:'utf8',env});
 assert.notEqual(result.status,0);assert.equal(fs.readFileSync(path.join(dir,'mobile/www/keep.txt'),'utf8'),'previous package');assert.equal(fs.existsSync(path.join(dir,'mobile/.build-history')),false);
});
