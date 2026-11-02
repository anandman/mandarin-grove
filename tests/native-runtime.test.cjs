const test=require('node:test'),assert=require('node:assert/strict');
let createMailbox;try{({createRestoredFileMailbox:createMailbox}=require('../mobile/src/restored-files.ts'));}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
function mailbox(options){assert.equal(typeof createMailbox,'function','Restored native file results have a bounded, one-shot, invalidatable owner');return createMailbox(options);}
const opened=text=>({pluginId:'GroveFiles',methodName:'openText',success:true,data:{cancelled:false,text}});

test('a restored selection retains exact original bytes until parent consumption, without importing or writing',()=>{
 let changes=0;const m=mailbox({notify:()=>changes++}),text='\ufeff\n合成 original\r\n',event=opened(text);
 assert.equal(m.hasPending,false);assert.equal(m.accept(event),true);event.data.text='mutated callback';
 assert.equal(changes,1);assert.equal(m.hasPending,true);assert.deepEqual(m.take(),{method:'open',cancelled:false,text});assert.equal(m.hasPending,false);assert.equal(m.take(),undefined);
});
test('duplicates and late callbacks cannot reopen a consumed restored import',()=>{
 const m=mailbox();assert.equal(m.accept(opened('synthetic original')),true);m.take();assert.equal(m.accept(opened('late duplicate')),false);assert.equal(m.hasPending,false);
});
test('erase/account invalidation clears a pending result and rejects late startup callbacks',()=>{
 const m=mailbox();m.accept(opened('synthetic private data'));m.invalidate();assert.equal(m.hasPending,false);assert.equal(m.take(),undefined);assert.equal(m.accept(opened('late previous context')),false);
 const beforeDelivery=mailbox();beforeDelivery.invalidate();assert.equal(beforeDelivery.accept(opened('late before delivery')),false);
});
test('unrelated plugins and future methods cannot supply a backup or consume the one allowed restored result',()=>{
 const m=mailbox();for(const e of [null,{}, {...opened('wrong'),pluginId:'Other'}, {...opened('wrong'),methodName:'futureMethod'}])assert.equal(m.accept(e),false);
 assert.equal(m.accept(opened('synthetic supported')),true);assert.equal(m.take().text,'synthetic supported');
});
test('restored cancel and save acknowledgements are distinct from an imported backup',()=>{
 for(const [event,result]of [[{pluginId:'GroveFiles',methodName:'openText',success:true,data:{cancelled:true}},{method:'open',cancelled:true}],[{pluginId:'GroveFiles',methodName:'saveText',success:true,data:{saved:true}},{method:'save',saved:true}],[{pluginId:'GroveFiles',methodName:'saveText',success:true,data:{saved:false}},{method:'save',saved:false}]]){const m=mailbox();m.accept(event);assert.deepEqual(m.take(),result);}
});
test('saved-file cleanup errors stay truthful; malformed and oversized results become bounded recovery notices',()=>{
 const m=mailbox();m.accept({pluginId:'GroveFiles',methodName:'saveText',success:false,error:{message:'Private temporary copy could not be removed.',code:'GROVE_EXPORT_SAVED'}});assert.deepEqual(m.take(),{method:'save',error:'Private temporary copy could not be removed.',saved:true});
 for(const event of [opened('合成'),{pluginId:'GroveFiles',methodName:'saveText',success:true,data:{saved:'yes'}},{pluginId:'GroveFiles',methodName:'openText',success:false,error:{message:'x'.repeat(4096)}}]){const m=mailbox({limit:4});m.accept(event);const result=m.take();assert.equal(typeof result.error,'string');assert.ok(result.error.length<=512);assert.equal(result.text,undefined);}
});

let installAudioLifecycle;({installAudioLifecycle}=require('../mobile/src/lifecycle.ts'));
function audioApp(){const callbacks={};return {callbacks,async addListener(name,fn){callbacks[name]=fn;return {async remove(){}};},async getState(){return {isActive:true};}};}
test('native pause cancels audio immediately, with foreground state used only for new playback',async()=>{
 assert.equal(typeof installAudioLifecycle,'function','Native audio observes supported App lifecycle');const app=audioApp(),states=[];await installAudioLifecycle(app,state=>states.push(state));app.callbacks.pause();app.callbacks.resume();assert.deepEqual(states,[true,false,true]);
});
test('late initial lifecycle query cannot reactivate an app that paused meanwhile',async()=>{
 assert.equal(typeof installAudioLifecycle,'function');const app=audioApp(),states=[];let release;app.getState=()=>new Promise(r=>release=r);const ready=installAudioLifecycle(app,state=>states.push(state));await new Promise(r=>setImmediate(r));app.callbacks.pause();release({isActive:true});await ready;assert.deepEqual(states,[false]);
});
