// Synthetic retained rounds only: no child backups or browser globals are required.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const api=fs.existsSync('core/mistakes.js')?require('../core/mistakes.js'):{};
const query=(state,options={})=>{assert.equal(typeof api.queryRecentMistakes,'function','portable recent-mistakes query is available');return api.queryRecentMistakes(state,{catalog:['学','狗','猫','买'],...options});};
const result=(mode,character,outcome,more={})=>({mode,character,outcome,correct:outcome==='correct',selfRated:mode==='flip'||mode==='dictation',...more});
const round=(id,rows,more={})=>({id,kind:'review',ended:100,q:rows.map(r=>[r.mode,r.character]),cursor:rows.length,results:Object.fromEntries(rows.map((r,i)=>[r.mode+':'+r.character+':'+i,r])),...more});
const modern=(id,character,evidence,more={})=>{const outcome=evidence.some(e=>e.outcome==='miss'||e.outcome==='unknown')?'miss':evidence.some(e=>e.outcome==='assisted')?'assisted':'correct';return result('dictation',character,outcome,{version:1,id,sessionId:id,itemId:(more.mode||'dictation')+':'+character,at:100,firstAttempt:{outcome,assisted:outcome==='assisted',skipped:false,ungraded:false},evidence,...more});};
const py=outcome=>({skill:'pinyin',method:'checked',outcome}),writing=outcome=>({skill:'writing',method:'self-rated',outcome});
const pairs=q=>q.pairs;

test('explicit misses/support form deduplicated needs while skip, unknown, partial, untaught and absent catalog stay neutral',()=>{
 const s={stars:12,learning:{chars:{猫:{skills:{listen:{misses:90}}}}},cfg:{notLearned:['猫']},studyHistory:[round('earlier',[result('listen','学','miss')]),round('one',[
  result('listen','学','assisted'),result('flip','狗','miss'),result('words','狗','unverified',{ungraded:true}),result('trace','买','skip'),result('memory','猫','miss'),result('listen','无','miss'),{character:'买',mode:'listen',correct:false},result('made-up','买','miss')
 ])]};
 const before=JSON.stringify(s),q=query(s);assert.deepEqual(pairs(q),[['flip','狗'],['listen','学']]);assert.equal(q.needs[1].needs[0].outcome,'assisted');assert.equal(q.needs[0].needs[0].method,'self-rated');assert.equal(JSON.stringify(s),before);assert.equal(query({stars:100,learning:s.learning}).hasDetails,false);
});

test('per-skill dictation outcomes resolve only matching evidence and preserve original score snapshots',()=>{
 const s={studyHistory:[round('a',[modern('a','买',[py('miss'),writing('miss')])]),round('b',[modern('b','买',[py('correct'),writing('assisted')])])]};
 const before=JSON.stringify(s),q=query(s);assert.deepEqual(pairs(q),[['dictation','买']]);assert.deepEqual(q.needs[0].needs.map(e=>[e.skill,e.method,e.outcome]),[['writing','self-rated','assisted']]);assert.equal(q.resolved[0].needs[0].skill,'pinyin');
 s.studyHistory.push(round('c',[modern('c','买',[py('unknown'),writing('correct')])]));assert.equal(query(s).needs.length,0);assert.equal(query(s).resolved.length,1);assert.equal(JSON.stringify({...s,studyHistory:s.studyHistory.slice(0,2)}),before);
 s.studyHistory.push(round('d',[modern('d','买',[py('miss')])]));assert.equal(query(s).needs[0].needs[0].skill,'pinyin');
});

test('new dictation components stay separate for mixed, both-right, both-wrong and incomplete evidence',()=>{
 const cases=[[[py('miss'),writing('correct')],['pinyin']],[[py('correct'),writing('miss')],['writing']],[[py('correct'),writing('correct')],[]],[[py('miss'),writing('miss')],['pinyin','writing']],[[py('miss'),writing('unknown')],['pinyin']]];
 for(const [evidence,want]of cases)assert.deepEqual(query({studyHistory:[round('a',[modern('a','学',evidence)])]}).needs.flatMap(x=>x.needs.map(e=>e.skill)),want);
});

test('legacy combined dictation is unsplit and needs a clean combined result to resolve',()=>{
 const s={studyHistory:[round('old',[result('dictation','买','miss')]),round('new',[modern('new','买',[py('correct'),writing('miss')])])]};
 let q=query(s);assert.equal(q.needs[0].needs.length,2);assert.ok(q.needs[0].needs.some(e=>e.legacyCombined&&e.skill==='combined'));
 s.studyHistory.push(round('clean',[modern('clean','买',[py('correct'),writing('correct')],{firstAttempt:{outcome:'correct',assisted:false,skipped:false,ungraded:false}})]));assert.equal(query(s).needs.length,0);
 const old=query({studyHistory:[round('a',[result('listen','学','miss',{selfRated:undefined})]),round('b',[result('listen','学','correct')])]});assert.equal(old.needs[0].needs[0].method,'unknown');
});

test('neutral or helped later work cannot clear a known need; another activity or self-rating cannot clear checked work',()=>{
 const s={studyHistory:[round('a',[result('listen','学','miss')]),round('b',[result('listen','学','skip'),result('flip','学','correct'),result('listen','学','correct',{selfRated:true}),result('words','学','unverified',{ungraded:true})])],cfg:{studyRounds:{'2':{review:round('unfinished',[result('listen','学','correct')])}}}};
 assert.deepEqual(pairs(query(s)),[['listen','学']]);
 s.studyHistory.push(round('helped',[modern('helped','学',[{skill:'listen',method:'checked',outcome:'correct'}],{mode:'listen',firstAttempt:{outcome:'assisted',assisted:true}})]));assert.equal(query(s).needs.length,1);
 s.studyHistory.push(round('success',[result('listen','学','correct')]));assert.equal(query(s,{characters:['学'],activities:['listen']}).needs.length,0);
});

test('skip/ungraded disposition overrides stale prior error flags and incomplete rounds do not enter history',()=>{
 const s={studyHistory:[round('skip',[modern('skip','学',[py('miss')],{outcome:'skip',firstAttempt:{outcome:'skip',skipped:true},correct:false})]),round('neutral',[modern('neutral','狗',[py('miss')],{ungraded:true})]),round('partial',[result('listen','买','miss')],{cursor:0})]};
 assert.equal(query(s).needs.length,0);
});

test('duplicate result/round identities cannot create contradictory claims and ordering uses retained append order',()=>{
 const a=round('same',[result('listen','学','miss')]),b=round('same',[result('listen','学','correct')]);assert.equal(query({studyHistory:[a,b]}).needs.length,0);assert.equal(query({studyHistory:[a,structuredClone(a)]}).needs.length,1);
 const x=modern('duplicate','学',[py('miss')]),y=modern('duplicate','学',[py('correct')]);assert.equal(query({studyHistory:[round('x',[x]),round('y',[y])]}).needs.length,0);
 const q=query({studyHistory:[round('future',[result('listen','学','miss')],{ended:900}),round('past',[result('listen','狗','miss')],{ended:1}),{results:{x:result('flip','买','miss')}}]});assert.deepEqual(pairs(q),[['flip','买'],['listen','狗'],['listen','学']]);
 assert.doesNotThrow(()=>query({studyHistory:[null,12,{results:[null,{},false]}, {results:'bad'}]}));
});

test('only last twenty completed rounds are retained, deduped pairs obey filters and finite limits',()=>{
 const s={studyHistory:[round('aged-out',[result('listen','学','miss')]),...Array.from({length:20},(_,i)=>round('neutral-'+i,[result('flip','狗','correct')]))]};assert.equal(query(s).needs.length,0);assert.equal(query(s).resolved.length,0);
 s.studyHistory.push(round('latest',['listen','trace','flip','memory','dictation','words'].flatMap(mode=>['学','狗','猫','买'].map(c=>result(mode,c,'miss')))));
 assert.equal(query(s,{limit:5}).pairs.length,5);assert.equal(query(s,{limit:10}).pairs.length,10);assert.equal(query(s,{limit:20}).pairs.length,20);assert.equal(query(s,{limit:30}).pairs.length,24);
 assert.deepEqual(pairs(query(s,{characters:['学'],activities:['listen','dictation']})),[['dictation','学'],['listen','学']]);
});

test('JSON refresh/profile/backup round trips preserve unknown fields, scores and earned history',()=>{
 const golden=JSON.parse(fs.readFileSync('tests/fixtures/backups/grove-v1.json','utf8')),before=JSON.stringify(golden);
 for(const raw of Object.values(golden.data)){const state=JSON.parse(raw),copy=JSON.parse(JSON.stringify(state));assert.deepEqual(query(state),query(copy));assert.equal(copy.studyHistory[0].score.correct,0);assert.equal(query(copy).needs.length,2);}
 assert.equal(JSON.stringify(golden),before);
 const alice={studyHistory:[round('alice',[result('listen','学','miss')])]},bob={studyHistory:[round('bob',[result('flip','狗','miss')])]};assert.deepEqual(pairs(query(alice)),[['listen','学']]);assert.deepEqual(pairs(query(bob)),[['flip','狗']]);assert.deepEqual(pairs(query(JSON.parse(JSON.stringify(alice)))),[['listen','学']]);
});

test('retained queue order determines within-round chronology even when result keys arrived in another order',()=>{
 const rows=[result('listen','学','miss'),result('flip','狗','miss')];const r=round('ordered',rows);r.results={later:rows[1],earlier:rows[0]};assert.deepEqual(pairs(query({studyHistory:[r]})),[['flip','狗'],['listen','学']]);
});

test('an explicit eligibility draft can restore a deferred character without changing saved eligibility',()=>{
 const s={cfg:{notLearned:['猫']},studyHistory:[round('restorable',[result('listen','猫','miss')])]};assert.equal(query(s).needs.length,0);assert.deepEqual(pairs(query(s,{excluded:[]})),[['listen','猫']]);assert.deepEqual(s.cfg.notLearned,['猫']);
});

test('contradictory combined question metadata cannot erase a legacy combined need',()=>{
 const dirty=modern('contradictory','买',[py('correct'),writing('correct')],{outcome:'miss',correct:false,firstAttempt:{outcome:'correct',assisted:false,skipped:false,ungraded:false}});
 const s={studyHistory:[round('old',[result('dictation','买','miss')]),round('new',[dirty])]};assert.deepEqual(pairs(query(s)),[['dictation','买']]);
});


test('v1 success needs coherent explicit first-attempt authority before it resolves an earlier miss',()=>{
 const old=round('old',[result('listen','学','miss')]);
 const clean=modern('new','学',[{skill:'listen',method:'checked',outcome:'correct'}],{mode:'listen'});
 const variants=[{outcome:'miss',correct:false,firstAttempt:{outcome:'miss',assisted:false,skipped:false,ungraded:false}},{firstAttempt:undefined},{firstAttempt:{outcome:'correct',assisted:true,skipped:false,ungraded:false}},{correct:false},{firstAttempt:{outcome:'correct'}}];
 for(const more of variants){const q=query({studyHistory:[old,round('new',[{...clean,...more}])]});assert.deepEqual(pairs(q),[['listen','学']]);assert.equal(q.resolved.length,0);}
 assert.equal(query({studyHistory:[old,round('new',[clean])]}).needs.length,0);
 const contradictory=modern('new','学',[py('correct'),writing('correct')],{outcome:'miss',correct:false,firstAttempt:{outcome:'miss',assisted:false,skipped:false,ungraded:false}});
 const q=query({studyHistory:[round('old',[modern('old','学',[py('miss'),writing('miss')])]),round('new',[contradictory])]});assert.deepEqual(q.needs[0].needs.map(e=>e.skill),['pinyin','writing']);assert.equal(q.resolved.length,0);
});

test('logical-question aliases are quarantined on conflict and exact repeated facts are deduplicated',()=>{
 const old=round('old',[result('listen','学','miss')]);
 const miss=modern('alias-a','学',[{skill:'listen',method:'checked',outcome:'miss'}],{mode:'listen',sessionId:'same-session'});
 const success=modern('alias-b','学',[{skill:'listen',method:'checked',outcome:'correct'}],{mode:'listen',sessionId:'same-session'});
 for(const history of [[old,round('same-session',[miss,success])],[old,round('r1',[miss]),round('r2',[success])],[old,round('legacy-alias',[result('listen','学','miss'),result('listen','学','correct')])]]){const q=query({studyHistory:history});assert.deepEqual(pairs(q),[['listen','学']]);assert.equal(q.resolved.length,0);}
 const repeated=query({studyHistory:[round('same-session',[miss,{...miss,id:'alias-c',at:101}])]});assert.equal(repeated.needs.length,1);assert.equal(repeated.needs[0].needs[0].order,1);
});

test('unsupported assessment methods stay neutral without hiding valid mixed dictation components',()=>{
 for(const [mode,skill,method]of [['dictation','writing','checked'],['dictation','pinyin','self-rated'],['listen','listen','self-rated'],['flip','flip','checked']]){
  assert.equal(query({studyHistory:[round('bad',[modern('bad','学',[{skill,method,outcome:'miss'}],{mode})])]}).needs.length,0);
 }
 assert.equal(query({studyHistory:[round('bad-old',[result('listen','学','miss',{selfRated:true})])]}).needs.length,0);
 const q=query({studyHistory:[round('mixed',[modern('mixed','学',[py('miss'),writing('correct')])])]});assert.deepEqual(q.needs[0].needs.map(e=>[e.skill,e.method]),[['pinyin','checked']]);
});
