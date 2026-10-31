const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),os=require('node:os');
const {exportStatic}=require('../scripts/export-static.cjs');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('the deployed release does not announce itself as a newer update',async()=>{
 const notices=[],ctx=vm.createContext({document:{addEventListener(){}},window:{addEventListener(){}},setTimeout(){},fetch:async()=>({ok:true,text:async()=>read('version.txt')})});
 vm.runInContext(read('version-check.js'),ctx);ctx.showAppUpdate=version=>notices.push(version);
 await ctx.chkVer();assert.deepEqual(notices,[],'Current app must agree with its own published release');
});

for(const stale of ['version-check.js','sw.js','index.html'])test('static export rejects a stale release in '+stale,()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'grove-version-test-')),root=path.join(temp,'source'),out=path.join(temp,'site');
 try{
  fs.mkdirSync(root);for(const name of require('../scripts/static-files.json')){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'fixture');}
  for(const dir of ['audio','strokes'])fs.mkdirSync(path.join(root,dir));
  const version=read('version.txt').trim();
  for(const name of ['index.html','version.txt','sw.js'])fs.writeFileSync(path.join(root,name),read(name));
  fs.writeFileSync(path.join(root,'version-check.js'),"const VER='"+version+"';\n");
  const file=path.join(root,stale);fs.writeFileSync(file,fs.readFileSync(file,'utf8').replaceAll(version,'20200101-old-1'));
  assert.throws(()=>exportStatic(fs.realpathSync(root),out),error=>error.message.includes('Release version mismatch')&&error.message.includes(stale));
  assert.equal(fs.existsSync(out),false,'Reject a mixed release before writing any public output');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

function events(extra={}){
 const listeners=new Map();return Object.assign(extra,{addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},emit(type){for(const fn of [...(listeners.get(type)||[])])fn();}});
}
function updater(){
 const timers=[],posted=[],makeWorker=(version,state)=>events({version,state,postMessage(message,ports){if(message.type==='GET_VERSION')ports[0].postMessage({version:this.version});else{assert.equal(message.type,'ACTIVATE');posted.push(this);}}}),worker=makeWorker('20261031-current-80','installing'),registration={installing:worker,waiting:null,active:{},async update(){}},container=events({controller:registration.active,async getRegistration(){return registration;}});
 class MessageChannel{constructor(){this.port1={onmessage:null,close(){}};this.port2={postMessage:data=>queueMicrotask(()=>this.port1.onmessage?.({data})),close(){}};}}
 const ctx=vm.createContext({MessageChannel,navigator:{serviceWorker:container},addEventListener(){},setTimeout(fn,ms){const timer={fn,ms,cleared:false};timers.push(timer);return timer;},clearTimeout(timer){if(timer)timer.cleared=true;}});
 vm.runInContext(read('offline.js'),ctx);
 return{ctx,worker,registration,container,timers,posted,makeWorker};
}
const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};

test('Update waits for installation beyond ten seconds and for the new controller',async()=>{
 const u=updater();let completed=false;
 const promise=u.ctx.activateOfflineUpdate().then(()=>{completed=true;});await settle();
 for(const timer of [...u.timers])if(timer.ms<=10000&&!timer.cleared)timer.fn();
 await settle();assert.equal(completed,false,'A slow install must not reload the still-cached old app');
 u.registration.installing=null;u.registration.waiting=u.worker;u.worker.state='installed';u.worker.emit('statechange');await settle();
 assert.equal(completed,false,'An installed worker is not yet controlling this page');
 u.worker.state='activated';u.registration.active=u.worker;u.registration.waiting=null;u.container.controller=u.worker;u.worker.emit('statechange');u.container.emit('controllerchange');
 await promise;assert.equal(completed,true);
});

test('a failed installation rejects instead of pretending the update is ready',async()=>{
 const u=updater(),promise=u.ctx.activateOfflineUpdate();await settle();
 u.worker.state='redundant';u.worker.emit('statechange');
 await assert.rejects(promise,/update|install/i);
});

test('an activation timeout rejects instead of reloading the old controller',async()=>{
 const u=updater();u.worker.state='installed';u.registration.installing=null;u.registration.waiting=u.worker;
 const promise=u.ctx.activateOfflineUpdate();await settle();
 for(const timer of [...u.timers])if(!timer.cleared)timer.fn();
 await assert.rejects(promise,/update|activat/i);
});

test('a waiting downloaded update activates without another network check',async()=>{
 const u=updater();u.worker.state='installed';u.registration.installing=null;u.registration.waiting=u.worker;
 u.registration.update=async()=>{throw Error('Network went offline after download');};
 const promise=u.ctx.activateOfflineUpdate();await settle();
 u.worker.state='activated';u.registration.active=u.worker;u.registration.waiting=null;u.container.controller=u.worker;u.worker.emit('statechange');u.container.emit('controllerchange');
 await promise;
});

test('an update network check times out without later activating an abandoned attempt',async()=>{
 const u=updater();u.registration.installing=null;let complete;
 u.registration.update=()=>new Promise(resolve=>{complete=resolve;});
 const promise=u.ctx.activateOfflineUpdate();await settle();
 assert.ok(u.timers.some(t=>!t.cleared),'A stalled update check needs a bounded failure');
 for(const timer of [...u.timers])if(!timer.cleared)timer.fn();
 await assert.rejects(promise,/update.*timed out/i);
 u.worker.state='installed';u.registration.waiting=u.worker;complete();await settle();
 assert.equal(u.posted.length,0,'A late download result cannot activate after the attempt failed');
});

test('Update skips an intermediate waiting release and installs the requested release',async()=>{
 const u=updater(),intermediate=u.makeWorker('20261031-intermediate-79','installed');let checks=0;
 u.registration.installing=null;u.registration.waiting=intermediate;
 u.registration.update=async()=>{checks++;u.registration.waiting=null;u.registration.installing=u.worker;};
 const promise=u.ctx.activateOfflineUpdate(u.worker.version);await settle();
 assert.equal(checks,1,'A different waiting worker must not replace the requested release');
 assert.equal(u.posted.includes(intermediate),false);
 u.worker.state='installed';u.registration.installing=null;u.registration.waiting=u.worker;u.worker.emit('statechange');await settle();
 u.worker.state='activated';u.container.controller=u.worker;u.worker.emit('statechange');u.container.emit('controllerchange');await promise;
 assert.deepEqual(u.posted,[u.worker]);
});

test('a requested installing worker takes precedence over an older waiting worker',async()=>{
 const u=updater();u.registration.waiting=u.makeWorker('20261031-intermediate-79','installed');
 const promise=u.ctx.activateOfflineUpdate(u.worker.version);await settle();
 assert.equal(u.posted.length,0,'Do not activate the older waiting worker');
 u.worker.state='installed';u.registration.installing=null;u.registration.waiting=u.worker;u.worker.emit('statechange');await settle();
 u.worker.state='activated';u.container.controller=u.worker;u.worker.emit('statechange');u.container.emit('controllerchange');await promise;
 assert.deepEqual(u.posted,[u.worker]);
});

test('a downloaded worker for the requested release can activate after the connection is lost',async()=>{
 const u=updater();u.worker.state='installed';u.registration.installing=null;u.registration.waiting=u.worker;
 u.registration.update=async()=>{throw Error('Offline');};
 const promise=u.ctx.activateOfflineUpdate(u.worker.version);await settle();
 assert.deepEqual(u.posted,[u.worker]);
 u.worker.state='activated';u.container.controller=u.worker;u.worker.emit('statechange');u.container.emit('controllerchange');await promise;
});

test('workers identify their actual cached release for an explicit update request',()=>{
 const handlers={},responses=[],ctx=vm.createContext({URL,self:{location:{href:'https://grove.test/sw.js'},addEventListener:(name,fn)=>handlers[name]=fn}});
 vm.runInContext(read('sw.js'),ctx);handlers.message({data:{type:'GET_VERSION'},ports:[{postMessage:message=>responses.push(message.version)}]});
 assert.deepEqual(responses,[read('version.txt').trim()]);
});
