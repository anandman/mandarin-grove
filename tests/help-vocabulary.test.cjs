const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const pack=JSON.parse(fs.readFileSync('content/elementary-vocabulary.json','utf8'));
const plain=value=>JSON.parse(JSON.stringify(value));
function context(extra={}){const c=vm.createContext(extra);for(const file of ['words.js','vocabulary.js','help.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);return c;}
const cards=[{c:'改',p:'gǎi',m:'to change',g:'2',w:''},{c:'谢',p:'xiè',m:'to thank',g:'2',w:''}];

test('sourced suggestions remain available without the optional broad dictionary and retain report identity',()=>{
 const c=context(),lookup=c.createHelpLookup(cards,null,[],pack);
 const example=c.helpLookupExamples(lookup,'改')[0];
 assert.equal(example?.text,'改正');assert.equal(example.readings[0].meaning,'to correct');
 assert.equal(c.searchHelpLookup(lookup,'謝謝').items[0]?.text,'谢谢');
 const report=c.helpFeedbackQuestion(example);
 assert.deepEqual(plain(report.content),{packId:'grove-elementary-vocabulary',itemId:'mg-vocab-0001',version:'1.0.0',sourceId:'cc-cedict-2026-10-20',reviewStatus:'pending-fluent-review'});
 assert.equal(report.m,'to correct');
 assert.equal(c.helpLookupExamples(lookup,'您').length,0);
});

test('elementary green display uses the supported simple sense while retaining underlying source metadata',()=>{
 const c=context(),card={c:'绿',p:'lǜ',m:'green; (slang) to cheat on a spouse',g:'3',readings:[{pinyin:'lǜ',evidence:{lines:['綠 绿 [lu:4] /green/(slang) to cheat on a spouse/']}}],source:{lexical:'cc-cedict-characters-2026-10-21',review:'dictionary-derived-unreviewed'}};
 const lookup=c.createHelpLookup([card]);
 assert.equal(c.searchHelpLookup(lookup,'绿').items[0].meaning,'green');
 assert.equal(card.m,'green; (slang) to cheat on a spouse');
 assert.equal(c.searchHelpLookup(lookup,'cheat').total,0);
 assert.equal(c.searchHelpLookup(lookup,'lu4').total,0);
});

test('lazy pack fetch coalesces, retries failures, and never puts typed text in a URL',async()=>{
 const c=context();assert.equal(typeof c.loadHelpVocabulary,'function');
 let calls=0;const urls=[];
 const fetcher=async url=>{urls.push(url);calls++;if(calls===1)throw Error('offline');return {ok:true,json:async()=>pack};};
 await assert.rejects(c.loadHelpVocabulary(fetcher),/offline/);
 const [a,b]=await Promise.all([c.loadHelpVocabulary(fetcher),c.loadHelpVocabulary(fetcher)]);
 assert.equal(a.id,pack.id);assert.equal(b.id,pack.id);assert.equal(calls,2);
 assert.deepEqual(urls,['content/elementary-vocabulary.json','content/elementary-vocabulary.json']);
 await c.loadHelpVocabulary(()=>{throw Error('cached lookup must not fetch');});
});

test('explicit report snapshot includes only bounded content identity and no arbitrary student text',()=>{
 const c=context({window:{},navigator:{userAgent:'fixture'},location:{origin:'http://localhost'},GR:()=> '2',SESS:null,selectedMandarinVoice:()=>null,voicePreference:()=> 'auto',speechText:card=>card.c});
 vm.runInContext(fs.readFileSync('feedback.js','utf8'),c);
 c.item=c.helpLookupExamples(c.createHelpLookup(cards,null,[],pack),'改')[0];
 vm.runInContext("feedbackQuestion=helpFeedbackQuestion(item);feedbackQuestion.content.studentDraft='PRIVATE TEXT';",c);
 const snapshot=c.feedbackSnapshot();assert.equal(snapshot.content?.itemId,'mg-vocab-0001');
 assert.ok(!JSON.stringify(c.feedbackPayload(snapshot)).includes('PRIVATE TEXT'));
 assert.deepEqual(plain(c.feedbackPayload(snapshot).content),plain(snapshot.content));
});

test('queued report payloads also discard unsupported content fields before any explicit send',()=>{
 const c=context();vm.runInContext(fs.readFileSync('feedback.js','utf8'),c);
 const content={packId:'grove-elementary-vocabulary',itemId:'mg-vocab-0001',version:'1.0.0',sourceId:'cc-cedict-2026-10-20',reviewStatus:'pending-fluent-review',studentDraft:'PRIVATE QUEUED TEXT'};
 assert.ok(!JSON.stringify(c.feedbackPayload({content})).includes('PRIVATE QUEUED TEXT'));
 assert.equal(c.feedbackPayload({content:{...content,version:'x'.repeat(41)}}).content,undefined);
});

test('malformed downloaded examples are not cached and a later valid retry can recover',async()=>{
 const c=context(),broken=plain(pack);broken.entries[0].word=7;
 await assert.rejects(c.loadHelpVocabulary(async()=>({ok:true,json:async()=>broken})),/examples-invalid/);
 const recovered=await c.loadHelpVocabulary(async()=>({ok:true,json:async()=>pack}));
 assert.equal(recovered.entries[0].word,'改正');
});

test('the selected displayed sense keeps broader dictionary searches and reading alternatives available',()=>{
 const c=context(),bank=c.createWordIndex({aliases:{},entries:[['谢谢','謝謝','xie4 xie5','to thank; thanks'],['学生','學生','xue2 sheng1','student']]});
 const lookup=c.createHelpLookup(cards,bank,[],pack),found=c.searchHelpLookup(lookup,'thank');
 assert.ok(found.items.some(row=>row.text==='谢谢'));
 assert.equal(c.searchHelpLookup(lookup,'student').items[0].text,'学生');
 assert.equal(c.searchHelpLookup(lookup,'謝謝').items[0].meaning,'thanks');
});
