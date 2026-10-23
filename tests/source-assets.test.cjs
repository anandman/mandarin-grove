const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('engine/stroke manifest pins licensed upstream bytes and all curriculum stroke files',()=>{
 assert.ok(fs.existsSync(path.join(ROOT,'vendor/source-assets.json')),'the upstream source manifest exists');
 const manifest=read('vendor/source-assets.json'),curriculum=read('content/curriculum.json');
 assert.equal(manifest.engine.version,'3.7.3');
 assert.equal(manifest.engine.license,'MIT');
 assert.equal(manifest.engine.file.sha256,'17b11a1e025b780cb518d49b30faacc770dfa7fbc387aa3876e3e5c1bd31e642');
 assert.equal(hash(fs.readFileSync(path.join(ROOT,manifest.engine.file.path))),manifest.engine.file.sha256);
 assert.equal(manifest.strokes.version,'2.0.1');
 assert.equal(manifest.strokes.license,'Arphic-Public-License AND LGPL-3.0-or-later');
 assert.equal(manifest.strokes.fieldLicenses.radStrokes,'LGPL-3.0-or-later');
 assert.equal(manifest.strokes.makeMeAHanziRevision,'9d54d6bbba93023078628589ffbffff1edf91335');
 assert.equal(manifest.strokes.dictionaryTxtIncluded,false);
 assert.equal(manifest.strokes.files.length,curriculum.cards.length);
 assert.deepEqual(new Set(manifest.strokes.files.map(row=>row.character)),new Set(curriculum.cards.map(row=>row.c)));
 for(const file of manifest.strokes.files){
  const bytes=fs.readFileSync(path.join(ROOT,file.path));assert.equal(hash(bytes),file.sha256,file.path);
  const data=JSON.parse(bytes);assert.ok(Object.keys(data).every(key=>['medians','strokes','radStrokes'].includes(key)));
  assert.ok(Array.isArray(data.strokes)&&Array.isArray(data.medians));
  assert.equal(data.strokes.length,data.medians.length,file.character);
  assert.ok(['byte-identical','json-equivalent'].includes(file.upstreamRelationship));
 }
 assert.ok(manifest.notices.some(row=>row.license==='MIT'));
 assert.ok(manifest.notices.some(row=>row.license==='Arphic-Public-License'));
 assert.ok(manifest.notices.some(row=>row.license==='LGPL-3.0-or-later'));
 for(const file of manifest.notices)assert.equal(hash(fs.readFileSync(path.join(ROOT,file.path))),file.sha256,file.path);
 assert.equal(manifest.audio.changed,false);
 assert.equal(manifest.audio.legacyPublicationRights,'unresolved');
});

test('source hash audit rejects missing or modified product assets without contacting upstream',()=>{
 assert.ok(fs.existsSync(path.join(ROOT,'scripts/audit-source-assets.cjs')),'the source audit exists');
 const {auditSourceAssets}=require('../scripts/audit-source-assets.cjs');
 assert.deepEqual(auditSourceAssets(ROOT,read('vendor/source-assets.json')).issues,[]);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'grove-asset-audit-'));
 try{
  fs.writeFileSync(path.join(dir,'engine.js'),'modified');
  const report=auditSourceAssets(dir,{engine:{file:{path:'engine.js',sha256:'0'.repeat(64)}},strokes:{files:[{path:'missing.json',sha256:'1'.repeat(64)}]},notices:[]});
  assert.ok(report.issues.some(row=>row.path==='engine.js'&&row.code==='sha256-mismatch'));
  assert.ok(report.issues.some(row=>row.path==='missing.json'&&row.code==='missing-file'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});


test('radical metadata verification derives stroke indices from the licensed decomposition source',()=>{
 const {radicalStrokeIndices}=require('../scripts/audit-source-assets.cjs');
 assert.equal(typeof radicalStrokeIndices,'function');
 assert.deepEqual(radicalStrokeIndices({character:'好',radical:'女',decomposition:'⿰女子',matches:[[0],[0],[0],[1],[1],[1]]}),[0,1,2]);
 assert.deepEqual(radicalStrokeIndices({character:'想',radical:'心',decomposition:'⿱⿰木目心',matches:[[0,0],[0,1],[1],[1]]}),[2,3]);
 assert.deepEqual(radicalStrokeIndices({character:'女',radical:'女',decomposition:'女',matches:[null,null,null]}),[]);
});
