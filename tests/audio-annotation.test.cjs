const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'../scripts/audio-annotation.cjs');
function api(){assert.ok(fs.existsSync(file),'Annotation spelling comparator is missing');return require(file)}
test('documented contractions preserve the initial and tone without consulting a target',()=>{
 const {annotationPinyin,annotationComponents}=api();
 assert.equal(annotationPinyin(' ch|uei3 '),'chui3');
 assert.equal(annotationPinyin('l|uen2'),'lun2');
 assert.equal(annotationPinyin('uei4'),'wei4');assert.equal(annotationPinyin('uen1'),'wen1');
 assert.deepEqual(annotationComponents('ch|uei3'),{initial:'ch',final:'ui',tone:'3'});
 assert.deepEqual(annotationComponents('l|uen2'),{initial:'l',final:'un',tone:'2'});
});
test('ordinary-u contractions cannot erase explicit ü or invent its expanded alias',()=>{
 const {annotationPinyin,annotationComponents}=api();
 assert.equal(annotationComponents('j|üen1'),null);assert.equal(annotationComponents('q|uen2'),null);
 assert.equal(annotationPinyin('j|üen1'),'jüen1');
 assert.deepEqual(annotationComponents('qun2'),{initial:'q',final:'vn',tone:'2'});
 assert.deepEqual(annotationComponents('n|u3'),{initial:'n',final:'u',tone:'3'});
 assert.deepEqual(annotationComponents('n|ü3'),{initial:'n',final:'v',tone:'3'});
});
test('whole-final matching leaves other vowels, nasal places and malformed labels alone',()=>{
 const {annotationPinyin,annotationComponents}=api();
 assert.equal(annotationPinyin('ueng1'),'ueng1');assert.equal(annotationPinyin('l|uan3'),'luan3');
 assert.deepEqual(annotationComponents('j|üan4'),{initial:'j',final:'van',tone:'4'});
 assert.equal(annotationComponents('h|uei'),null);
 assert.equal(annotationComponents(null),null);assert.equal(annotationComponents(['hui4']),null);
});
