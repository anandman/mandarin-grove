#!/usr/bin/env node
// Verify pinned product assets and notices offline. Audio is outside this audit.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function radicalStrokeIndices(source){
 if(source.character===source.radical)return [];
 const tokens=[...(source.decomposition||'')],arity={'⿰':2,'⿱':2,'⿲':3,'⿳':3,'⿴':2,'⿵':2,'⿶':2,'⿷':2,'⿸':2,'⿹':2,'⿺':2,'⿻':2};let cursor=0,found=null;
 function visit(position){
  const token=tokens[cursor++],children=arity[token]||0;
  if(children){for(let child=0;child<children;child++)visit([...position,child]);}
  else if(found===null&&token===source.radical)found=position;
 }
 visit([]);if(!found?.length)return [];
 return (source.matches||[]).flatMap((match,index)=>JSON.stringify(match)===JSON.stringify(found)?[index]:[]);
}
function auditSourceAssets(root,manifest){
 const files=[manifest.engine?.file,manifest.strokes?.dictionarySource,...(manifest.strokes?.files||[]),...(manifest.notices||[])].filter(Boolean),issues=[];
 for(const file of files){
  const target=path.resolve(root,file.path),relative=path.relative(root,target);
  if(relative.startsWith('..'+path.sep)||path.isAbsolute(relative)){issues.push({path:file.path,code:'outside-root'});continue;}
  if(!fs.existsSync(target)){issues.push({path:file.path,code:'missing-file'});continue;}
  const bytes=fs.readFileSync(target),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  if(sha256!==file.sha256)issues.push({path:file.path,code:'sha256-mismatch'});
 }
 const dictionaryFile=manifest.strokes?.dictionarySource?.path;
 if(dictionaryFile&&fs.existsSync(path.join(root,dictionaryFile))){
  const rows=fs.readFileSync(path.join(root,dictionaryFile),'utf8').trim().split('\n').map(line=>JSON.parse(line)),byChar=new Map(rows.map(row=>[row.character,row]));
  for(const file of manifest.strokes.files||[]){
   if(!fs.existsSync(path.join(root,file.path)))continue;
   const data=JSON.parse(fs.readFileSync(path.join(root,file.path),'utf8')),source=byChar.get(file.character);
   if(!source){issues.push({path:file.path,code:'radical-source-missing'});continue;}
   if(JSON.stringify(data.radStrokes||[])!==JSON.stringify(radicalStrokeIndices(source)))issues.push({path:file.path,code:'radical-source-mismatch'});
  }
 }
 return {checked:files.length,issues};
}
if(require.main===module){
 const root=path.resolve(__dirname,'..');
 try{const report=auditSourceAssets(root,JSON.parse(fs.readFileSync(path.join(root,'vendor/source-assets.json'),'utf8')));process.stdout.write(JSON.stringify(report,null,2)+'\n');if(report.issues.length)process.exitCode=1;}
 catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
}
module.exports={auditSourceAssets,radicalStrokeIndices};
