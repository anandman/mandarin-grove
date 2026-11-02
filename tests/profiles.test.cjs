const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function labels(values={}){const context=vm.createContext({Date:class extends Date{static now(){return 10*86400000;}},localStorage:{getItem:key=>values[key]??null},QU:g=>g==='4'?[[1,'祖正'],[2,'止离']]:g==='2'?[[1,'狗猫'],[2,'牛努']]:[[1,'一二']]});if(fs.existsSync('profiles.js'))vm.runInContext(fs.readFileSync('profiles.js','utf8'),context);return context;}
test('backup age labels distinguish absent, today, yesterday and older saved copies',()=>{
 for(const [value,want]of [[undefined,'Never'],['bad','Never'],[String(10*86400000),'Today'],[String(9*86400000),'Yesterday'],[String(7*86400000),'3 days ago']]){const c=labels({'zh_bk':value});assert.equal(typeof c.BKA,'function','independent backup-label API exists');assert.equal(c.BKA(),want);}
});
test('backup summaries use each profile grade and retained unit selection, and tolerate old partial state',()=>{
 const c=labels();assert.equal(typeof c.BKW,'function','independent profile-summary API exists');
 assert.equal(c.BKW({gr:'4'},JSON.stringify({cfg:{quiz:'止离'}})),'Grade 4, Unit 2');assert.equal(c.BKW({gr:'2'},JSON.stringify({cfg:{set:['狗','猫']}})),'Grade 2, Unit 1');assert.equal(c.BKW({gr:'K'},'broken'),'Kindergarten');assert.equal(c.BKW({gr:'4'},JSON.stringify({stars:25})),'Grade 4');
});

// A queued native dialog close must finish once, before a newer view starts audio.
function dialogHarness(){
 const previous={isConnected:true,focusCount:0,focus(){this.focusCount++;}};
 const c=labels();c.stopCount=0;c.stopSpeech=()=>c.stopCount++;
 c.document={activeElement:previous,getElementById:()=>null};c.profileStyles=()=>{};
 c.profileElement=(tag)=>({tag,isConnected:false,open:false,append(){},setAttribute(){},remove(){this.isConnected=false;},close(){this.open=false;this.queuedClose=this.onclose;}});
 const dialog=c.profileDialog('test-dialog','Synthetic');dialog.isConnected=true;dialog.open=true;
 return {c,dialog,previous};
}
test('closing a dialog finishes before newer audio and queued close cannot cancel it',()=>{
 const {c,dialog,previous}=dialogHarness();c.profileClose(dialog);
 assert.equal(previous.focusCount,1,'Return focus before the next view opens');
 const stopped=c.stopCount;dialog.queuedClose();
 assert.equal(c.stopCount,stopped,'Old queued close cannot stop newer speech');
 assert.equal(previous.focusCount,1,'Old queued close cannot steal focus from newer view');
});
test('native Escape close cancels speech, removes dialog and restores focus once',()=>{
 const {c,dialog,previous}=dialogHarness();dialog.open=false;dialog.onclose();
 assert.equal(c.stopCount,1);assert.equal(dialog.isConnected,false);assert.equal(previous.focusCount,1);
 dialog.onclose();assert.equal(c.stopCount,1);assert.equal(previous.focusCount,1);
});

test('Continue into Grown-ups closes once and cannot replace newer settings on queued close',()=>{
 const {c,previous}=dialogHarness();let dialog,continueAction,settingsOpened=0;
 c.document.body={append(value){dialog=value;value.isConnected=true;}};
 c.profileButton=(parent,text,id,action)=>{if(id==='parent-entry-continue')continueAction=action;return {focus(){}};};
 c.grown=()=>settingsOpened++;
 const make=c.profileElement;c.profileElement=(tag)=>{const el=make(tag);el.showModal=()=>el.open=true;return el;};
 c.parentEntry(previous);continueAction();
 assert.equal(c.stopCount,1,'Continue stops the old dialog speech');
 assert.equal(settingsOpened,1);const focusCount=previous.focusCount;
 dialog.queuedClose();assert.equal(settingsOpened,1,'Queued close cannot replace the new settings');
 assert.equal(c.stopCount,1,'Queued close cannot stop new audio');assert.equal(previous.focusCount,focusCount,'Queued close cannot steal new focus');
});
