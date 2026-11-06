const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const api=()=>require('../scripts/release.cjs');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'grove-release-'));
 const files={
  'release.json':JSON.stringify({version:'1.0.100',build:100,future:{keep:true}}),
  'version.txt':'1.0.100\n','version-check.js':"const VER='1.0.100';\n// keep this code\n",'sw.js':"const VERSION='1.0.100',ROOT='/';\n",
  'index.html':'<script src="app.js?v=1.0.100"></script><link rel="stylesheet" href="styles.css?v=1.0.100">\n',
  'mobile/android/app/build.gradle':'android { defaultConfig { versionCode 100\nversionName "1.0.100"\n} }\n',
  'mobile/ios/App/App.xcodeproj/project.pbxproj':'CURRENT_PROJECT_VERSION = 100;\nMARKETING_VERSION = 1.0.100;\nCURRENT_PROJECT_VERSION = 100;\nMARKETING_VERSION = 1.0.100;\nOTHER_SETTING = keep;\n'
 };
 for(const dir of ['', 'mobile/']){
  files[dir+'package.json']=JSON.stringify({name:'fixture',version:'1.0.100',future:{keep:['unknown']}});
  files[dir+'package-lock.json']=JSON.stringify({name:'fixture',version:'1.0.100',lockfileVersion:3,packages:{'':{name:'fixture',version:'1.0.100',license:'MIT'},'node_modules/example':{version:'9.8.7'}}});
 }
 for(const [name,data]of Object.entries(files)){const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data);}
 return root;
}
const bytes=root=>Object.fromEntries(['release.json','version.txt','version-check.js','sw.js','index.html','package.json','package-lock.json','mobile/package.json','mobile/package-lock.json','mobile/android/app/build.gradle','mobile/ios/App/App.xcodeproj/project.pbxproj'].map(n=>[n,fs.readFileSync(path.join(root,n),'utf8')]));
test('one release checks every web, Android, iOS and npm label',()=>{
 const root=fixture();assert.deepEqual(api().checkRelease(root),{version:'1.0.100',build:100});
});
for(const [name,change]of [
 ['Android version','mobile/android/app/build.gradle'],['both iOS configurations','mobile/ios/App/App.xcodeproj/project.pbxproj'],['web cache marker','version-check.js'],['web asset URL','index.html'],['npm metadata','mobile/package.json'],['lock root','mobile/package-lock.json']
])test('release check rejects drift in '+name,()=>{
 const root=fixture(),file=path.join(root,change);fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('1.0.100','1.0.99'));
 assert.throws(()=>api().checkRelease(root),/mismatch|drift/i);
});
test('one setter advances all platform labels and preserves unrelated code/metadata',()=>{
 const root=fixture();api().setRelease(root,{version:'1.0.101',build:101});assert.deepEqual(api().checkRelease(root),{version:'1.0.101',build:101});
 assert.match(fs.readFileSync(path.join(root,'version-check.js'),'utf8'),/keep this code/);
 assert.match(fs.readFileSync(path.join(root,'mobile/ios/App/App.xcodeproj/project.pbxproj'),'utf8'),/OTHER_SETTING = keep/);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'release.json'))).future,{keep:true});
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'mobile/package.json'))).future,{keep:['unknown']});
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'mobile/package-lock.json'))).packages['node_modules/example'].version,'9.8.7');
});
test('bootstrap synchronizes preserved legacy labels without requiring an old release.json',()=>{
 const root=fixture();fs.unlinkSync(path.join(root,'release.json'));const file=path.join(root,'mobile/android/app/build.gradle');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('versionCode 100','versionCode 10'));
 api().setRelease(root,{version:'1.0.100',build:100});assert.deepEqual(api().checkRelease(root),{version:'1.0.100',build:100});
});
for(const request of [{version:'1.0.099',build:101},{version:'1.0.101',build:99},{version:'1.0.101',build:100},{version:'1.0.100',build:101},{version:'bad',build:101},{version:'1.0.101',build:0}])test('invalid/decreasing/reused release cannot partially change files '+JSON.stringify(request),()=>{
 const root=fixture(),before=bytes(root);assert.throws(()=>api().setRelease(root,request));assert.deepEqual(bytes(root),before);
});
test('ambiguous source markers fail before any release file is written',()=>{
 const root=fixture(),file=path.join(root,'mobile/android/app/build.gradle');fs.appendFileSync(file,'versionCode 999\n');const before=bytes(root);
 assert.throws(()=>api().setRelease(root,{version:'1.0.101',build:101}),/marker|ambiguous/i);assert.deepEqual(bytes(root),before);
});
for(const [file,marker]of [['mobile/android/app/build.gradle','versionCode 100'],['mobile/ios/App/App.xcodeproj/project.pbxproj','CURRENT_PROJECT_VERSION = 100']])test('native build counter drift is rejected in '+file,()=>{
 const root=fixture(),p=path.join(root,file);fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(marker,marker.replace('100','99')));assert.throws(()=>api().checkRelease(root),/mismatch/i);
});
