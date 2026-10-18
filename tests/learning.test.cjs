const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({Date,Math});
vm.runInContext(fs.readFileSync('app.js','utf8').split('\n').find(l=>l.startsWith('const ALL=')),c);
if(fs.existsSync('learning.js'))vm.runInContext(fs.readFileSync('learning.js','utf8'),c);
const day=864e5, now=new Date(2026,9,18,12).getTime();
const state=()=>({pts:{},box:{},due:{},cfg:{},stars:40});
test('cram stays under 30 with balanced mixed modes and no duplicate questions',()=>{
 const pool=Array.from({length:100},(_,i)=>({c:String(i)}));
 const q=c.cramQueue(pool,['listen','trace','flip','memory'],30,a=>a.slice().reverse());
 assert.equal(q.length,30);assert.equal(new Set(q.map(([m,x])=>m+x.c)).size,30);
 for(const m of ['listen','trace','flip','memory'])assert.ok(q.filter(x=>x[0]===m).length>=7);
 assert.equal(c.cramQueue(pool.slice(0,2),['listen','trace','flip','memory'],30,a=>a).length,8);
});
test('same-day correct answers cannot inflate spaced mastery',()=>{
 const s=state();for(let i=0;i<20;i++)c.recordSkill(s,'狗','memory','correct',now+i*1000);
 assert.equal(s.learning.chars['狗'].skills.memory.level,1);assert.equal(s.stars,40);
});
test('spaced success expands intervals and failure brings review back',()=>{
 const s=state();c.recordSkill(s,'狗','listen','correct',now);
 let r=c.skillState(s,'狗','listen');assert.equal(r.due,now+day);
 c.recordSkill(s,'狗','listen','correct',r.due);r=c.skillState(s,'狗','listen');assert.equal(r.level,2);assert.equal(r.due,now+4*day);
 c.recordSkill(s,'狗','listen','miss',r.due);r=c.skillState(s,'狗','listen');assert.equal(r.level,0);assert.equal(r.due,now+4*day+600000);
});
test('tracing and old rewards alone do not establish recall mastery',()=>{
 const s=state();s.pts['狗']=50;assert.equal(c.characterStage(s,'狗',now),'Previously practiced');
 for(let i=0;i<5;i++)c.recordSkill(s,'狗','trace','correct',now+i*40*day);
 assert.notEqual(c.characterStage(s,'狗',now+160*day),'Mastered');
 for(const m of ['listen','memory','pinyin']){let t=now;for(let i=0;i<3;i++){c.recordSkill(s,'狗',m,'correct',t);t=c.skillState(s,'狗',m).due;}}
 assert.equal(c.characterStage(s,'狗',now+4*day),'Mastered');
 assert.equal(c.characterStage(s,'狗',now+12*day),'Review due');
});
test('assistance and skips are tracked separately from independent success',()=>{
 const s=state();c.recordSkill(s,'狗','memory','assisted',now);c.recordSkill(s,'猫','listen','skip',now);
 assert.equal(c.skillState(s,'狗','memory').correct,0);assert.equal(c.skillState(s,'狗','memory').assisted,1);
 assert.equal(c.skillState(s,'猫','listen').skips,1);assert.equal(c.skillState(s,'猫','listen').level,0);
});
test('progressive practice prioritizes overdue skills and limits new characters',()=>{
 const s=state(),pool=Array.from('狗猫子女大小上下左右',c=>({c}));
 c.recordSkill(s,'狗','listen','miss',now-day);
 const q=c.progressiveQueue(s,pool,10,false,now,a=>a);
 assert.equal(q[0][1].c,'狗');assert.equal(q[0][0],'listen');
 assert.ok(new Set(q.filter(([,x])=>x.c!=='狗').map(([,x])=>x.c)).size<=3);
 assert.ok(q.length<=10);
});
test('learning state survives JSON backup while legacy data stays unchanged',()=>{
 const s=state();s.pts['狗']=5;s.box['狗']=2;s.due['狗']=30000;const before=JSON.stringify([s.pts,s.box,s.due,s.cfg]);
 c.recordSkill(s,'狗','flip','correct',now);assert.equal(JSON.stringify([s.pts,s.box,s.due,s.cfg]),before);
 assert.equal(c.skillState(JSON.parse(JSON.stringify(s)),'狗','flip').correct,1);
});
test('manual practice revisits overdue evidence before introducing unstudied characters',()=>{
 const s=state();c.recordSkill(s,'狗','memory','miss',Date.now()-day);
 assert.equal(c.reviewPick(s,[{c:'猫'},{c:'狗'}],'memory').c,'狗');
});

test('pinyin requirement follows earliest curriculum grade, not learner grade',()=>{
 const units=JSON.parse(fs.readFileSync('tests/fixtures/better-immersion-k5.json'));
 const seen=new Set();
 for(const grade of ['K','1','2','3','4','5'])for(const [,chars] of units[grade])for(const ch of chars){
  if(seen.has(ch))continue;seen.add(ch);
  assert.equal(c.characterNeedsPinyin(ch),Number(grade)>=2,`${ch} first appears in ${grade}`);
 }
});
test('grade 2 mastery requires spaced pinyin and its due date participates in status',()=>{
 const s=state();
 for(const mode of ['listen','memory']){let t=now;for(let i=0;i<3;i++){c.recordSkill(s,'狗',mode,'correct',t);t=c.skillState(s,'狗',mode).due;}}
 assert.notEqual(c.characterStage(s,'狗',now+4*day),'Mastered');
 let t=now;for(let i=0;i<3;i++){c.recordSkill(s,'狗','pinyin','correct',t);t=c.skillState(s,'狗','pinyin').due;}
 assert.equal(c.characterStage(s,'狗',now+4*day),'Mastered');
 s.learning.chars['狗'].skills.pinyin.due=now+5*day;
 assert.equal(c.characterStage(s,'狗',now+5*day),'Review due');
 c.recordSkill(s,'狗','pinyin','miss',now+5*day);
 assert.notEqual(c.characterStage(s,'狗',now+5*day),'Mastered');
});
test('early-grade mastery does not require pinyin',()=>{
 const s=state();for(const mode of ['listen','memory']){let t=now;for(let i=0;i<3;i++){c.recordSkill(s,'一',mode,'correct',t);t=c.skillState(s,'一',mode).due;}}
 assert.equal(c.characterStage(s,'一',now+4*day),'Mastered');
});
test('tracing tolerates two recognition mistakes but still distinguishes help',()=>{
 assert.equal(c.traceOutcome(2,false),'correct');assert.equal(c.traceOutcome(3,false),'assisted');assert.equal(c.traceOutcome(0,true),'assisted');
});
test('separate sessions must still wait the full due interval',()=>{
 const s=state();c.recordSkill(s,'狗','listen','correct',now);
 c.recordSkill(s,'狗','listen','correct',now+6*3600000);
 c.recordSkill(s,'狗','listen','correct',now+13*3600000);
 assert.equal(c.skillState(s,'狗','listen').level,1);
 assert.equal(c.skillState(s,'狗','listen').correct,3);
 c.recordSkill(s,'狗','listen','correct',now+day);
 assert.equal(c.skillState(s,'狗','listen').level,2);
});

test('daily practice includes combined pinyin questions only when enabled',()=>{
 const pool=Array.from('狗猫子',c=>({c}));
 for(const enabled of [false,true]){
  const q=c.progressiveQueue(state(),pool,10,false,now,a=>a,enabled);
  assert.equal(q.some(([m])=>m==='dictation'),enabled);assert.ok(q.length<=10);
 }
});
test('due writing and pinyin combine into one question and cannot be starved',()=>{
 const s=state(),pool=Array.from('狗猫子女大小上下左右',c=>({c}));
 for(const card of pool)for(const mode of ['listen','trace','flip','memory'])c.recordSkill(s,card.c,mode,'miss',now-2*day);
 for(const mode of ['pinyin','writing'])c.recordSkill(s,'狗',mode,'miss',now-day);
 const q=c.progressiveQueue(s,pool,10,false,now,a=>a,true);
 assert.equal(q.length,10);assert.equal(q.filter(([m,x])=>m==='dictation'&&x.c==='狗').length,1);
 assert.equal(new Set(q.map(([m,x])=>m+x.c)).size,q.length);
});
