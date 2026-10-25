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
