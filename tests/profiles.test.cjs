const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function labels(values={}){const context=vm.createContext({Date:class extends Date{static now(){return 10*86400000;}},localStorage:{getItem:key=>values[key]??null},QU:g=>g==='4'?[[1,'祖正'],[2,'止离']]:g==='2'?[[1,'狗猫'],[2,'牛努']]:[[1,'一二']]});if(fs.existsSync('profiles.js'))vm.runInContext(fs.readFileSync('profiles.js','utf8'),context);return context;}
test('backup age labels distinguish absent, today, yesterday and older saved copies',()=>{
 for(const [value,want]of [[undefined,'Never'],['bad','Never'],[String(10*86400000),'Today'],[String(9*86400000),'Yesterday'],[String(7*86400000),'3 days ago']]){const c=labels({'zh_bk':value});assert.equal(typeof c.BKA,'function','independent backup-label API exists');assert.equal(c.BKA(),want);}
});
test('backup summaries use each profile grade and retained unit selection, and tolerate old partial state',()=>{
 const c=labels();assert.equal(typeof c.BKW,'function','independent profile-summary API exists');
 assert.equal(c.BKW({gr:'4'},JSON.stringify({cfg:{quiz:'止离'}})),'Grade 4, Unit 2');assert.equal(c.BKW({gr:'2'},JSON.stringify({cfg:{set:['狗','猫']}})),'Grade 2, Unit 1');assert.equal(c.BKW({gr:'K'},'broken'),'Kindergarten');assert.equal(c.BKW({gr:'4'},JSON.stringify({stars:25})),'Grade 4');
});
