const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({});for(const f of ['words.js','vocabulary.js','help.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
test('school characters and sourced examples lead without dropping broad matches or exact aliases',()=>{
 const cards=[{c:'改',p:'gǎi',m:'to change',g:'2'}],pack=JSON.parse(fs.readFileSync('content/elementary-vocabulary.json','utf8'));
 const raw={aliases:{},entries:[['劳改','勞改','lao2 gai3','reform through labor'],['土改','土改','tu3 gai3','land reform'],['改正','改正','gai3 zheng4','to correct']]};
 const before=JSON.stringify(raw),index=c.createHelpLookup(cards,c.createWordIndex(raw),[],pack),found=c.searchHelpLookup(index,'改');
 assert.deepEqual(Array.from(found.items.slice(0,2),r=>r.text),['改','改正']);assert.ok(found.items.some(r=>r.text==='劳改'));assert.ok(c.searchHelpLookup(index,'勞改').items.some(r=>r.text==='劳改'));assert.equal(c.searchHelpLookup(index,'lao2 gai3').items[0].text,'劳改');
 assert.equal(c.searchHelpLookup(index,'改正').items[0].text,'改正');assert.equal(JSON.stringify(raw),before,'Presentation ranking preserves every dictionary reading and source row');
});
