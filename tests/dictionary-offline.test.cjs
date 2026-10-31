const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
test('Help dictionary importer retains single characters, mixed headwords and every definition',()=>{
 const file='scripts/build-dictionary.cjs';assert.ok(fs.existsSync(file),'complete dictionary importer exists');
 const {parseDictionary}=require('../'+file),rows=parseDictionary('學 学 [xue2] /to study/to learn/learning/knowledge/\n3C 3C [san1 C] /computers, communications, and consumer electronics/\n');
 assert.deepEqual(rows,[['学','學','xue2','to study; to learn; learning; knowledge'],['3C','','san1 C','computers, communications, and consumer electronics']]);
});
test('complete offline Help dictionary has non-school characters and preserves original word checking data',()=>{
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync('vendor/cc-cedict/words.json')).digest('hex'),'6d9e0258fb39e78cc2d00c3cf76c403cdcd5db2789fcb6ecaa724bcb6bf81feb');
 assert.ok(fs.existsSync('vendor/cc-cedict/dictionary.json'),'complete offline dictionary exists');
 const bank=JSON.parse(fs.readFileSync('vendor/cc-cedict/dictionary.json'));
 assert.equal(bank.entries.length,125319);assert.ok(bank.entries.some(r=>r[0]==='鑫'));assert.ok(bank.entries.some(r=>r[0]==='银行'));
});
test('school characters retain their identity and gain dictionary senses without duplicate rows',()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('words.js','utf8'),ctx);vm.runInContext(fs.readFileSync('help.js','utf8'),ctx);
 const index=ctx.createHelpLookup([{c:'行',p:'xíng',m:'to go',g:'2'}],ctx.createWordIndex({entries:[['行','','xing2','to walk'],['行','','hang2','row; profession'],['鑫','','xin1','prosperity']]}));
 assert.equal(index.rows.filter(r=>r.text==='行').length,1);assert.equal(index.byText.get('行').kind,'character');
 assert.ok(ctx.searchHelpLookup(index,'hang2').items.some(r=>r.text==='行'));assert.equal(ctx.searchHelpLookup(index,'鑫').items[0].text,'鑫');
});
test('app update preserves public reading caches and the offline shell only admits explicit public assets',()=>{
 assert.ok(fs.existsSync('sw.js'),'offline service worker exists');const assets=JSON.parse(fs.readFileSync('offline-assets.json'));
 assert.ok(assets.includes('vendor/cc-cedict/dictionary.json'));assert.ok(assets.includes('index.html'));
 assert.equal(assets.some(p=>/docs\/|HANDOFF|api\/|audio\//.test(p)),false);
});
test('real full-bank aliases cannot replace canonical school characters or their practice selection',()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('words.js','utf8'),ctx);vm.runInContext(fs.readFileSync('help.js','utf8'),ctx);
 const cards=require('../content/curriculum.json').cards,index=ctx.createHelpLookup(cards,ctx.createWordIndex(JSON.parse(fs.readFileSync('vendor/cc-cedict/dictionary.json'))));
 for(const ch of ['么','宁']){assert.equal(index.byText.get(ch).text,ch);assert.equal(index.byText.get(ch).kind,'character');assert.equal(JSON.stringify(ctx.helpPracticeCharacters(index,[ch]).map(c=>c.c)),JSON.stringify([ch]));}
});
test('activating a new worker during an older document load keeps versioned scripts consistent',async()=>{
 const source=fs.readFileSync('sw.js','utf8'),version=source.match(/const VERSION='([^']+)'/)[1],old='20261025-supported-70',handlers={},calls=[];
 const manifest=JSON.stringify(['index.html','app.js','offline-assets.json']),banks=new Map([
  ['mandarin-grove-shell-'+version,new Map([['offline-assets.json',manifest],['app.js','new app']])],
  ['mandarin-grove-shell-'+old,new Map([['offline-assets.json',manifest],['index.html','old HTML with version70 scripts'],['app.js','old app']])]
 ]);
 const ctx=vm.createContext({URL,Request,Response,Set,caches:{has:async k=>banks.has(k),open:async k=>({match:async p=>banks.get(k)?.has(p)?new Response(banks.get(k).get(p)):undefined})},fetch:async r=>{calls.push(r);return new Response('NETWORK CURRENT APP');},self:{location:{origin:'https://grove.test',href:'https://grove.test/sw.js'},addEventListener:(n,f)=>handlers[n]=f}});
 vm.runInContext(source,ctx);
 // The old HTML was obtained before activation. Its remaining requests arrive at the new worker.
 assert.match(banks.get('mandarin-grove-shell-'+old).get('index.html'),/old HTML/);
 async function request(v){let pending;handlers.fetch({request:new Request('https://grove.test/app.js?v='+v),respondWith:p=>pending=p});return pending;}
 assert.equal(await (await request(old)).text(),'old app');assert.equal(await (await request(version)).text(),'new app');
 assert.equal((await request('20261025-supported-69')).status,409,'missing old version fails closed instead of mixing current scripts');assert.equal(calls.length,0);
});
