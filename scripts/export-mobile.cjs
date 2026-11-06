// Build only from the public web allowlist. Never serve or bundle the workspace.
const fs=require('node:fs'),path=require('node:path');
const {exportStatic}=require('./export-static.cjs');
const {scaleNativeTextStyles}=require('./native-text-style.cjs');
const {checkRelease,buildInfo}=require('./release.cjs');
function exportMobile(root,output,{internalTests=false,requireCleanSource=false}={}){
 const base=fs.realpathSync(root),out=path.resolve(output);
 if(out===base||base.startsWith(out+path.sep))throw Error('Output cannot contain the source workspace');
 if(fs.existsSync(out))throw Error('Refusing to replace an existing output');
 const bridge=path.join(base,'mobile/dist',internalTests?'bridge-testing.js':'bridge.js');
 if(!fs.existsSync(bridge)||fs.lstatSync(bridge).isSymbolicLink()||!fs.realpathSync(bridge).startsWith(base+path.sep))throw Error('Build the native bridge first');
 exportStatic(base,out,{feedback:'local',requireCleanSource});
 // Only authored app declarations; vendor/content payloads are never rewritten.
 for(const file of require('./static-files.json').filter(file=>!file.includes('/')&&/\.(css|js|html)$/.test(file))){
  const target=path.join(out,file);fs.writeFileSync(target,scaleNativeTextStyles(fs.readFileSync(target,'utf8')));
 }
 // Install native readiness before theme/preferences or the learner bootstrap.
 const index=path.join(out,'index.html');let html=fs.readFileSync(index,'utf8');
 html=html.replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g,(tag,src)=>['offline.js','version-check.js'].includes(src.split('?')[0])?'':tag);
 const version=JSON.stringify(fs.readFileSync(path.join(base,'version.txt'),'utf8').trim());
 html=html.replace(/<link\b[^>]*rel="manifest"[^>]*>/g,'').replace('<html lang="en"',`<html data-grove-native="true" data-native-persistence="sqlite" data-native-internal-tests="${internalTests}" lang="en"`);
 html=html.replace(/(<script\b[^>]*src=)/,`<script src="native/bridge.js"></script>\n<script>const VER=${version};</script>\n$1`);
 fs.mkdirSync(path.join(out,'native'));fs.copyFileSync(bridge,path.join(out,'native/bridge.js'));fs.writeFileSync(index,html);
 // Capacitor's local SPA handler serves index.html for extensionless paths.
 // Keep the original notices and copy byte-identical text aliases for its reader.
 fs.mkdirSync(path.join(out,'native/notices'));
 for(const [source,name]of [['vendor/cc-cedict/LICENSE','cc-cedict.txt'],['vendor/writing-spark/LICENSE','writing-spark.txt']])fs.copyFileSync(path.join(out,source),path.join(out,'native/notices',name));
 // Reuse the existing offline notices reader; these SDKs are native-only.
 const nativeNotices=path.join(base,'mobile/resources/THIRD-PARTY-NOTICES.txt');
 if(!fs.lstatSync(nativeNotices).isFile()||fs.lstatSync(nativeNotices).isSymbolicLink()||!fs.realpathSync(nativeNotices).startsWith(base+path.sep))throw Error('Unsafe native notices source');
 fs.appendFileSync(path.join(out,'vendor/SOURCE-NOTICES.md'),'\n\n'+fs.readFileSync(nativeNotices,'utf8'));
 return out;
}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),out=path.join(root,'mobile/www');
 const internalTests=process.argv.includes('--internal-tests');
 // Reject an unqualified release before even moving the previous generated app.
 buildInfo(root,{requireCleanSource:!internalTests});checkRelease(root);
 // Keep previous generated packages for recovery instead of deleting them on rebuild.
 if(fs.existsSync(out)){
  if(fs.lstatSync(out).isSymbolicLink()||!fs.statSync(out).isDirectory())throw Error('Unsafe generated mobile output');
  const history=path.join(root,'mobile/.build-history');fs.mkdirSync(history,{recursive:true});fs.renameSync(out,path.join(history,'www-'+Date.now()+'-'+process.pid));
 }
 console.log('Native public assets exported to '+exportMobile(root,out,{internalTests,requireCleanSource:!internalTests}));
}
module.exports={exportMobile};
