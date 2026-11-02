const test=require('node:test'),assert=require('node:assert/strict');
let resolveNotice;try{({resolveBundledNotice:resolveNotice}=require('../mobile/src/navigation.ts'));}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
const resolve=(...args)=>{assert.equal(typeof resolveNotice,'function','Known bundled notice URLs have a bounded native reader');return resolveNotice(...args);};
test('existing bundled notice paths resolve on both native schemes, dropping query and fragment',()=>{
 for(const base of ['https://localhost/','capacitor://localhost/']){
  const result=resolve('audio-sources/LICENSE-MSU.txt?v=87#source',base);assert.equal(result.url,base+'audio-sources/LICENSE-MSU.txt');assert.match(result.title,/MSU.*license/);
 }
});
test('a null custom-scheme origin never admits a different host or scheme',()=>{
 for(const url of ['capacitor://evil/audio-sources/LICENSE-MSU.txt','https://localhost/audio-sources/LICENSE-MSU.txt','javascript:alert(1)','data:text/plain,notice','file:///audio-sources/LICENSE-MSU.txt'])assert.equal(resolve(url,'capacitor://localhost/'),undefined);
});
test('only six shipped notices are admitted, never arbitrary app files or credentials',()=>{
 const paths=['audio-sources/LICENSE-MSU.txt','audio-sources/MSU-VERIFICATION.json','vendor/SOURCE-NOTICES.md','vendor/cc-cedict/LICENSE','content/online-reading-notices.txt','vendor/writing-spark/LICENSE'];
 for(const p of paths)assert.ok(resolve(p,'https://localhost/'));
 for(const p of ['index.html','app.js','exports/backup.txt','https://user:password@localhost/vendor/cc-cedict/LICENSE','https://example.com/vendor/cc-cedict/LICENSE','http://localhost/vendor/cc-cedict/LICENSE'])assert.equal(resolve(p,'https://localhost/'),undefined);
});

test('extensionless licenses use text aliases instead of the native SPA fallback',()=>{
 for(const [source,alias]of [['vendor/cc-cedict/LICENSE','native/notices/cc-cedict.txt'],['vendor/writing-spark/LICENSE','native/notices/writing-spark.txt']])assert.equal(resolve(source,'capacitor://localhost/').url,'capacitor://localhost/'+alias);
});
