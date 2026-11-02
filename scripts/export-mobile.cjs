// Build only from the public web allowlist. Never serve or bundle the workspace.
const fs=require('node:fs'),path=require('node:path');
const {exportStatic}=require('./export-static.cjs');
function exportMobile(root,output){
 const base=fs.realpathSync(root),out=path.resolve(output);
 if(out===base||base.startsWith(out+path.sep))throw Error('Output cannot contain the source workspace');
 if(fs.existsSync(out))throw Error('Refusing to replace an existing output');
 const bridge=path.join(base,'mobile/dist/bridge.js');
 if(!fs.existsSync(bridge)||fs.lstatSync(bridge).isSymbolicLink()||!fs.realpathSync(bridge).startsWith(base+path.sep))throw Error('Build the native bridge first');
 exportStatic(base,out,{feedback:'local'});
 // Preserve every sourced asset while booting only the read-only engineering check.
 const index=path.join(out,'index.html');let html=fs.readFileSync(index,'utf8');
 html=html.replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g,(tag,src)=>src.split('?')[0]==='vendor/hanzi-writer.js'?tag:'');
 html=html.replace(/<link\b[^>]*rel="manifest"[^>]*>/g,'').replace('<html lang="en"','<html data-grove-native="true" data-native-persistence="disabled" lang="en"').replace('</body>','<script src="native/bridge.js"></script>\n</body>');
 fs.mkdirSync(path.join(out,'native'));fs.copyFileSync(bridge,path.join(out,'native/bridge.js'));fs.writeFileSync(index,html);
 return out;
}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),out=path.join(root,'mobile/www');
 // Keep previous generated packages for recovery instead of deleting them on rebuild.
 if(fs.existsSync(out)){
  if(fs.lstatSync(out).isSymbolicLink()||!fs.statSync(out).isDirectory())throw Error('Unsafe generated mobile output');
  const history=path.join(root,'mobile/.build-history');fs.mkdirSync(history,{recursive:true});fs.renameSync(out,path.join(history,'www-'+Date.now()+'-'+process.pid));
 }
 console.log('Native public assets exported to '+exportMobile(root,out));
}
module.exports={exportMobile};
