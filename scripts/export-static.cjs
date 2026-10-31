// Publish the same app-only assets as the local preview, never the workspace root.
const fs=require('node:fs');
const path=require('node:path');
const publicFiles=require('./static-files.json');
function exportStatic(root,output,{feedback='server'}={}){
 if(!['server','local'].includes(feedback))throw Error('Unknown feedback capability');
 const out=path.resolve(output),base=path.resolve(root);
 if(out===base||base.startsWith(out+path.sep))throw Error('Output cannot contain the source workspace');
 // Only the conventional generated dist folder may be replaced on repeat builds.
 if(fs.existsSync(out)){
  if(out!==path.join(base,'dist')||fs.lstatSync(out).isSymbolicLink())throw Error('Refusing to replace a non-generated output directory');
  fs.rmSync(out,{recursive:true,force:true});
 }
 fs.mkdirSync(out,{recursive:true});
 function copy(relative){
  const input=path.join(base,relative),real=fs.realpathSync(input);
  if(!real.startsWith(base+path.sep)||fs.lstatSync(input).isSymbolicLink()||!fs.statSync(input).isFile())throw Error('Unsafe public asset: '+relative);
  const dest=path.join(out,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(input,dest);
 }
 for(const file of publicFiles)copy(file);
 for(const [dir,extensions]of [['audio',['.mp3','.wav']],['strokes',['.json']]]){
  const folder=path.join(base,dir);
  if(fs.lstatSync(folder).isSymbolicLink())throw Error('Unsafe public asset directory: '+dir);
  for(const file of fs.readdirSync(folder))if(extensions.some(extension=>file.endsWith(extension)))copy(path.join(dir,file));
 }
 if(feedback==='local'){
  const index=path.join(out,'index.html'),html=fs.readFileSync(index,'utf8');
  if(!html.includes('data-feedback="server"'))throw Error('Missing feedback capability');
  fs.writeFileSync(index,html.replace('data-feedback="server"','data-feedback="local"'));
 }
 fs.writeFileSync(path.join(out,'.nojekyll'),'');
 return out;
}
if(require.main===module){
 const root=path.resolve(__dirname,'..');console.log('Static app exported to '+exportStatic(root,process.argv[2]||path.join(root,'dist'),{feedback:process.argv.includes('--pages')?'local':'server'}));
}
module.exports={exportStatic};
