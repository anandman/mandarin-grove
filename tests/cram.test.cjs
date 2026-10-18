const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const cards=[{c:'狗'},{c:'猫'},{c:'子'}];
 const ctx=vm.createContext({ALL:cards,CARDS:[cards[2]],GR:()=> '2',CHK:()=>[{k:'Unit',n:1,c:['狗','猫']},{k:'Set',n:1,c:['子']}],HSETS:()=>({o:[{g:'2',id:'2:Unit 1',t:'Unit 1',c:['狗','猫']},{g:'2',id:'2:Extra set 1',t:'Extra set 1',supplemental:true,c:['子']}]}),shuffle:a=>a.slice().reverse(),stopSpeech(){},nextItem(){},SESS:null,lq:[],mq:[],TH:[],TF:[],dictStart(){}});
 vm.runInContext(fs.readFileSync('learning.js','utf8'),ctx);vm.runInContext(fs.readFileSync('cram.js','utf8'),ctx);return ctx;
}
test('mixed cram covers every selected character in every practice mode',()=>{
 const c=harness();vm.runInContext("cramSelection['2']=new Set([1]);startCram('mixed')",c);
 const q=c.SESS.q;assert.equal(q.length,10);
 for(const char of ['狗','猫'])assert.deepEqual(Array.from(q.filter(x=>x[1].c===char),x=>x[0]).sort(),['dictation','flip','listen','memory','trace']);
 assert.ok(q.every(x=>x[1].c!=='子'));assert.equal(c.CARDS.length,1);assert.equal(c.CARDS[0].c,'子');
});
test('supplemental set can be selected without any numbered units',()=>{
 const c=harness();vm.runInContext("cramSelection['2']=new Set(['set:1']);startCram('mixed')",c);
 assert.equal(c.SESS.q.length,5);assert.ok(c.SESS.q.every(x=>x[1].c==='子'));
});
test('empty selection does not start a mixed session',()=>{
 const c=harness();vm.runInContext("cramSelection['2']=new Set();startCram('mixed')",c);assert.equal(c.SESS,null);
});

test('same-number units from added grades have separate selections',()=>{
 const c=harness();c.HSETS=()=>({o:[{g:'2',id:'2:Unit 1',t:'Unit 1',c:['狗','猫']},{g:'K',id:'K:Unit 1',t:'Unit 1',a:true,c:['子','猫']}]});
 const choices=c.cramChoices();assert.equal(choices.length,2);assert.notEqual(choices[0].id,choices[1].id);
 vm.runInContext("cramSelection['2']=new Set(['K:Unit 1']);startCram()",c);
 assert.deepEqual(Array.from(c.SESS.pool,x=>x.c),['子','猫']);
 vm.runInContext("cramSelection['2'].add(1);startCram()",c);
 assert.equal(c.SESS.pool.length,3);assert.equal(c.SESS.q.length,15);
});
test('only groups present in My Characters are offered for cram',()=>{
 const c=harness();c.HSETS=()=>({o:[{g:'2',id:'2:Unit 1',t:'Unit 1',c:['狗','猫']}]});
 assert.equal(c.cramChoices().length,1);
 vm.runInContext("cramSelection['2']=new Set(['K:Unit 1']);startCram()",c);assert.equal(c.SESS,null);
});

test('mixed questions are randomized across modes instead of four mode blocks',()=>{
 const c=harness();let seed=12345;
 c.shuffle=items=>{const a=Array.from(items);for(let i=a.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=Math.floor(seed/4294967296*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 vm.runInContext("cramSelection['2']=new Set([1,'set:1']);startCram()",c);
 const modes=Array.from(c.SESS.q,x=>x[0]);
 const changes=modes.slice(1).filter((m,i)=>m!==modes[i]).length;
 assert.ok(changes>3,`Expected interleaved modes, got ${modes.join(', ')}`);
 const first=Array.from(c.SESS.q,x=>x[0]+':'+x[1].c);
 vm.runInContext('startCram()',c);
 assert.notDeepEqual(Array.from(c.SESS.q,x=>x[0]+':'+x[1].c),first);
 assert.equal(new Set(c.SESS.q.map(x=>x[0]+':'+x[1].c)).size,15);
});

test('mixed mode grade gate and 30-question balance',()=>{
 const c=harness();for(const grade of ['K','1','2','3','4','5']){c.GR=()=>grade;assert.equal(c.mixedCramModes().includes('dictation'),Number(grade)>=2);}
 const q=c.cramQueue(Array.from({length:40},(_,i)=>({c:String(i)})),c.mixedCramModes(),30,a=>a);
 assert.equal(q.length,30);for(const mode of c.mixedCramModes())assert.equal(q.filter(([m])=>m===mode).length,6);
});
