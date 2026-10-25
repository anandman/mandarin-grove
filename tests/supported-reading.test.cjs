const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const api=()=>{assert.ok(fs.existsSync('core/readings.js'),'portable reading helpers exist');return require('../core/readings.js');};
test('reading aids align individual sentences even when a source paragraph contains two',()=>{
 const rows=api().readingSentences(['我看书。你呢？'],{pinyin:['Wǒ kànshū. Nǐ ne?'],translation:['I read. And you?']});
 assert.deepEqual(rows,[{text:'我看书。',pinyin:'Wǒ kànshū.',english:'I read.',words:[]},{text:'你呢？',pinyin:'Nǐ ne?',english:'And you?',words:[]}]);
 assert.throws(()=>api().readingSentences(['我看书。你呢？'],{pinyin:['Wǒ kànshū.'],translation:['I read.']}),/align/);
});
test('tap lookup keeps phrases together, permits unknown characters and preserves punctuation',()=>{
 const index=new Map([['学校',[['学校','','xue2 xiao4','school']]],['学',[['学','','xue2','study']]]]);
 const rows=api().readingTokens('我去学校。鑫',index);
 assert.equal(rows.map(r=>r.text).join(''),'我去学校。鑫');assert.ok(rows.some(r=>r.text==='学校'&&r.lookup));assert.ok(rows.some(r=>r.text==='鑫'&&r.lookup));assert.equal(rows.find(r=>r.text==='。').lookup,false);
 const marked=api().readingTokens('银行',index,[{word:'银行',pinyin:'yínháng',meaning:'bank'}]);assert.equal(marked[0].meaning,'bank');assert.equal(marked[0].pinyin,'yínháng');
});
test('reading recommendations target the actual selected characters with prior-grade support and exclusions',()=>{
 const grades={K:'我你有小',1:'家学校',2:'猫狗树',3:'河',4:'船'};
 assert.equal(typeof api().readingScope,'function');
 const scope=api().readingScope({grade:'2',chars:['猫'],excluded:['你'],grades});
 assert.equal(api().readingMatch({characters:['我','家','有','小','猫'],minGrade:2},scope).eligible,true);
 assert.equal(api().readingMatch({characters:['我','家','有','狗']},scope).eligible,false,'unselected current-grade words do not slip in');
 assert.equal(api().readingMatch({characters:['我','你','猫']},scope).eligible,false,'explicitly deferred support characters stay excluded');
 assert.equal(api().readingMatch({characters:['我','家']},scope).eligible,false,'reading must practise a selected target');
 assert.equal(api().readingMatch({characters:['我','猫','船']},api().readingScope({grade:'4',chars:['猫'],excluded:[],grades})).eligible,true);
 assert.equal(api().readingMatch({characters:['我']},api().readingScope({grade:'2',chars:[],grades})).eligible,false);
});
test('Grade2 starter readings contain only curriculum characters and have aligned contextual aids',()=>{
 assert.ok(fs.existsSync('content/reading-practice.js'),'offline starter readings exist');const pack=require('../content/reading-practice.js'),curriculum=require('../content/curriculum.json');
 assert.ok(pack.items.length>=3);
 for(const item of pack.items){
  const allowed=new Set(['K','1','2'].flatMap(g=>[...curriculum.grades[g]]));
  for(const ch of (item.titleZh+item.paragraphs.join('')).match(/\p{Script=Han}/gu))assert.ok(allowed.has(ch),item.id+' unexpected '+ch);
  const sentences=api().readingSentences(item.paragraphs,{pinyin:item.support.pinyin,translation:item.support.english},item.annotations);assert.ok(sentences.length>=3);
  assert.deepEqual([...new Set((item.titleZh+item.paragraphs.join('')).match(/\p{Script=Han}/gu))].sort(),item.characters.slice().sort());
 }
});
test('comprehension keeps the first answer and never upgrades assisted evidence',()=>{
 assert.equal(typeof api().newReadingSession,'function');
 const q={id:'who',options:[{id:'a',text:'A'},{id:'b',text:'B'}],answer:'b'};
 const original=api().newReadingSession('pets','1','review',4,100);
 const first=api().recordReadingAnswer(original,q,'a');assert.equal(first.responses.who.correct,false);assert.equal(first.responses.who.assisted,false);assert.deepEqual(original.responses,{});
 assert.deepEqual(api().recordReadingAnswer(first,q,'b'),first);
 const helped={...original,helpUsed:true};const answer=api().recordReadingAnswer(helped,q,'b');assert.equal(answer.responses.who.assisted,true);
 assert.equal(api().recordReadingAnswer({...answer,helpUsed:false},q,'b').responses.who.assisted,true);
 assert.throws(()=>api().recordReadingAnswer(original,q,'invented'));
});
test('reading resume validates content identity and keeps unknown and malformed older progress',()=>{
 const session=api().newReadingSession('pets','1','practice',4,100),question={id:'who',options:[{id:'a',text:'A'}],answer:'a'};
 const recorded=api().recordReadingAnswer({...session,phase:'questions'},question,'a');
 assert.ok(api().restoreReadingSession(recorded,{id:'pets',version:'1',kind:'practice',count:4},[question]));
 assert.equal(api().restoreReadingSession(recorded,{id:'pets',version:'2',kind:'practice',count:4},[question]),null);
 assert.equal(api().restoreReadingSession({...recorded,responses:{who:{choice:'invented'}}},{id:'pets',version:'1',kind:'practice',count:4},[question]),null);
 assert.equal(api().restoreReadingSession({...recorded,phase:'questions',cursor:1},{id:'pets',version:'1',kind:'practice',count:4},[question]),null,'cannot resume past the last question');
 const old={version:1,opaque:{preserve:1},sessions:{other:{keep:'old'},pets:{malformed:'original'}}};
 const bank=api().storeReadingSession(old,'pets',recorded,true);assert.deepEqual(bank.opaque,old.opaque);assert.deepEqual(bank.sessions.other,old.sessions.other);assert.deepEqual(bank.preserved[0],{key:'pets',value:old.sessions.pets});assert.equal(old.sessions.pets.malformed,'original');
 const unusual={version:1,sessions:{},history:[null],preserved:{unknown:'retain'}};const done={...recorded,phase:'done',cursor:1};const kept=api().storeReadingSession(unusual,'pets',done);assert.deepEqual(kept.history[0],null);assert.ok(kept.preserved.some(x=>x.value?.unknown==='retain'));
});
test('each starter has source-bound questions and a text explanation identifying the answer',()=>{
 for(const item of require('../content/reading-practice.js').items){assert.ok(item.questions?.length>=2,item.id);for(const q of item.questions){assert.ok(q.options.some(o=>o.id===q.answer));assert.ok(q.explanation.length>10);assert.ok(Number.isInteger(q.sentence)&&q.sentence<item.paragraphs.length);}}
});
test('reading evidence roundtrips with both frozen backup generations and preserves every other child',()=>{
 const backup=require('../core/backup.js'),codec={decodeUtf8:s=>Buffer.from(s,'base64').toString('utf8'),encodeUtf8:s=>Buffer.from(s,'utf8').toString('base64')};
 for(const name of ['original-v1','grove-v1']){
  const snapshot=JSON.parse(fs.readFileSync('tests/fixtures/backups/'+name+'.json')),original=JSON.parse(JSON.stringify(snapshot)),id=snapshot.PR.list[0].id,state=JSON.parse(snapshot.data[id]);
  state.readingStudy=api().storeReadingSession(undefined,'pets',api().newReadingSession('pets','1','practice',4,100));snapshot.data[id]=JSON.stringify(state);
  const decoded=backup.decodeBackup(codec.encodeUtf8(JSON.stringify(snapshot)),codec),again=backup.decodeBackup(backup.encodeBackup(decoded,codec),codec);
  assert.deepEqual(again,decoded);const restored=JSON.parse(again.rawProfiles[id]);assert.deepEqual(restored.readingStudy,state.readingStudy);delete restored.readingStudy;assert.deepEqual(restored,JSON.parse(original.data[id]));
  for(const other of snapshot.PR.list.filter(p=>p.id!==id))assert.equal(again.rawProfiles[other.id],original.data[other.id]);
 }
});
