const fs=require('node:fs'),path=require('node:path');
const android='mobile/android/app/build.gradle',ios='mobile/ios/App/App.xcodeproj/project.pbxproj';
function validate(value){
 if(!value||!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value.version)||!Number.isSafeInteger(value.build)||value.build<1||value.build>2100000000)throw Error('Invalid common release version/build');
 return {version:value.version,build:value.build};
}
function read(root,name){const p=path.join(root,name);if(fs.lstatSync(p).isSymbolicLink()||!fs.statSync(p).isFile())throw Error('Unsafe release source: '+name);return fs.readFileSync(p,'utf8');}
function readRelease(root){return validate(JSON.parse(read(root,'release.json')));}
function matches(text,pattern,count,name){const found=[...text.matchAll(pattern)];if(found.length!==count)throw Error('Ambiguous or missing release marker: '+name);return found;}
const code=/\bversionCode\s+(\d+)/g,name=/\bversionName\s+"([^"]+)"/g,project=/\bCURRENT_PROJECT_VERSION\s*=\s*(\d+);/g,marketing=/\bMARKETING_VERSION\s*=\s*([\d.]+);/g;
function checkRelease(root){
 const release=readRelease(root),{version,build}=release;
 const same=(actual,wanted,file)=>{if(actual!==wanted)throw Error('Release version mismatch: '+file+' (expected '+wanted+', found '+actual+')');};
 same(read(root,'version.txt').trim(),version,'version.txt');
 for(const [file,pattern]of [['version-check.js',/\bconst VER='([^']+)'/g],['sw.js',/\bconst VERSION='([^']+)'/g]])same(matches(read(root,file),pattern,1,file)[0][1],version,file);
 const urls=[...read(root,'index.html').matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)="([^"]+)"/g)];
 if(!urls.length)throw Error('Missing release asset markers: index.html');
 for(const url of urls)same(new URL(url[1],'https://grove.invalid/').searchParams.get('v'),version,'index.html');
 const gradle=read(root,android),xcode=read(root,ios);
 same(Number(matches(gradle,code,1,android)[0][1]),build,android);same(matches(gradle,name,1,android)[0][1],version,android);
 for(const row of matches(xcode,project,2,ios))same(Number(row[1]),build,ios);
 for(const row of matches(xcode,marketing,2,ios))same(row[1],version,ios);
 for(const prefix of ['', 'mobile/']){
  same(JSON.parse(read(root,prefix+'package.json')).version,version,prefix+'package.json');
  const file=prefix+'package-lock.json';if(fs.existsSync(path.join(root,file))){const lock=JSON.parse(read(root,file));same(lock.version,version,file);if(lock.packages?.[''])same(lock.packages[''].version,version,file+' root');}
 }
 return release;
}
function setRelease(root,value){
 const {version,build}=validate(value),changes=new Map();
 const oldConfig=fs.existsSync(path.join(root,'release.json'))?JSON.parse(read(root,'release.json')):null;
 const gradle=read(root,android),xcode=read(root,ios);
 const priorCodes=matches(gradle,code,1,android).map(r=>Number(r[1])).concat(matches(xcode,project,2,ios).map(r=>Number(r[1])));
 matches(gradle,name,1,android);matches(xcode,marketing,2,ios);
 if(oldConfig){const old=validate(oldConfig);priorCodes.push(old.build);if((build===old.build)!==(version===old.version))throw Error('A new version and common build must advance together');const a=version.split('.').map(Number),b=old.version.split('.').map(Number);for(let i=0;i<3;i++){if(a[i]<b[i])throw Error('Release version cannot decrease');if(a[i]>b[i])break;}}
 if(build<Math.max(...priorCodes))throw Error('Common release build cannot decrease');
 const oldVersion=read(root,'version.txt').trim();if(!/^(?:\d{8}-[a-z0-9-]+|\d+\.\d+\.\d+)$/.test(oldVersion))throw Error('Invalid existing web release marker');
 changes.set('release.json',JSON.stringify({...oldConfig,version,build},null,2)+'\n');changes.set('version.txt',version+'\n');
 for(const [file,pattern]of [['version-check.js',/\bconst VER='([^']+)'/g],['sw.js',/\bconst VERSION='([^']+)'/g]]){
  const text=read(root,file);matches(text,pattern,1,file);changes.set(file,text.replace(pattern,m=>m.replace(/'[^']+'/,"'"+version+"'")));
 }
 const html=read(root,'index.html');if(!html.includes('?v='+oldVersion))throw Error('Missing release marker: index.html');changes.set('index.html',html.replaceAll('?v='+oldVersion,'?v='+version));
 changes.set(android,gradle.replace(code,'versionCode '+build).replace(name,'versionName "'+version+'"'));
 changes.set(ios,xcode.replace(project,'CURRENT_PROJECT_VERSION = '+build+';').replace(marketing,'MARKETING_VERSION = '+version+';'));
 for(const prefix of ['', 'mobile/'])for(const file of ['package.json','package-lock.json']){
  const relative=prefix+file;if(!fs.existsSync(path.join(root,relative)))continue;
  const data=JSON.parse(read(root,relative));data.version=version;if(file==='package-lock.json'&&data.packages?.[''])data.packages[''].version=version;
  changes.set(relative,JSON.stringify(data,null,2)+'\n');
 }
 // All inputs, counters and expected markers are validated before the first write.
 for(const [file,text]of changes)fs.writeFileSync(path.join(root,file),text);
 return checkRelease(root);
}
if(require.main===module){
 try{const root=path.resolve(__dirname,'..'),[command='check',version,number]=process.argv.slice(2);if(!['check','set'].includes(command))throw Error('Usage: release.cjs check | set VERSION BUILD');console.log(JSON.stringify(command==='set'?setRelease(root,{version,build:Number(number)}):checkRelease(root)));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={readRelease,checkRelease,setRelease};
