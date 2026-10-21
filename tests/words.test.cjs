const test=require('node:test'),assert=require('node:assert/strict');
const {createWordIndex,checkWordAnswer,collectWord,pinyinWithMarks}=require('../words.js');
const {parseCedict}=require('../scripts/build-word-bank.cjs');
const rows=[['学校','學校','xue2 xiao4','school'],['学生','學生','xue2 sheng1','student'],['小学','小學','xiao3 xue2','primary school'],['小狗','','xiao3 gou3','puppy']];
const index=createWordIndex({entries:rows,aliases:{'学':['學']}});
test('word checking handles traditional forms, the target character and genuine dictionary entries',()=>{
 const result=checkWordAnswer('学',' 學校 ',index,[]);assert.equal(result.status,'recognized');assert.equal(result.word,'学校');assert.equal(result.entries[0][3],'school');
 assert.equal(checkWordAnswer('学','小狗',index,[]).status,'missing-target');
 assert.equal(checkWordAnswer('学','学校',index,['学校']).status,'duplicate');
 assert.equal(checkWordAnswer('学','學校',index,['学校']).status,'duplicate');
});
test('unknown expressions remain unverified and incomplete or non-Chinese input gets guidance',()=>{
 assert.equal(checkWordAnswer('学','学新词语',index,[]).status,'unverified');
 assert.equal(checkWordAnswer('学','學新詞語',index,[]).status,'unverified');
 for(const input of ['','学','学校。','学 校','school','<img>'])assert.equal(checkWordAnswer('学',input,index,[]).status,'input-help');
});
test('collecting a recognized word adds local vocabulary without changing learning or earned rewards',()=>{
 const state={stars:149,cfg:{cramUnits:{'4':[1,3]}},learning:{chars:{学:{skills:{listen:{level:2}}}}},rewards:{grove:{balance:10}}},before=JSON.stringify(state);
 const unknown=checkWordAnswer('学','学新词语',index,[]);assert.equal(collectWord(state,'学',unknown),false);assert.equal(JSON.stringify(state),before);
 const result=checkWordAnswer('学','学校',index,[]);assert.equal(collectWord(state,'学',result),true);assert.equal(collectWord(state,'学',result),false);
 const copy=JSON.parse(JSON.stringify(state));delete copy.wordPractice;assert.equal(JSON.stringify(copy),before);assert.deepEqual(state.wordPractice.words.学,['学校']);
});
test('dictionary pinyin renders tones including ü, compound syllables and neutral tone',()=>{
 assert.equal(pinyinWithMarks('xue2 xiao4'),'xué xiào');assert.equal(pinyinWithMarks('nv3 er2'),'nǚ ér');assert.equal(pinyinWithMarks('lu:4 se4'),'lǜ sè');assert.equal(pinyinWithMarks('hai2 zi5'),'hái zi');assert.equal(pinyinWithMarks('liu2 shui3'),'liú shuǐ');
});
test('the CC-CEDICT importer retains independently licensed word data and excludes single-character cards',()=>{
 const text='# license header\n學校 学校 [xue2 xiao4] /school/CL:所[suo3]/\n學 学 [xue2] /study/\n學生 学生 [xue2 sheng1] /student/pupil/\n';
 const data=parseCedict(text);assert.equal(data.length,2);assert.deepEqual(data[0],['学校','學校','xue2 xiao4','school']);
});
