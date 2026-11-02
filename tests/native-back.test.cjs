const test=require('node:test'),assert=require('node:assert/strict');
let createController;try{({createAndroidBackController:createController}=require('../mobile/src/lifecycle.ts'));}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
function controller(app,reportError){assert.equal(typeof createController,'function','Android Back uses an awaited, serialized supported App controller');return createController(app,reportError);}
function fixture(){const calls=[],app={async addListener(name,fn){calls.push(['listen',name]);app.back=fn;return {async remove(){calls.push(['remove']);}};},async toggleBackButtonHandler(options){calls.push(['enable',options.enabled]);},async minimizeApp(){calls.push(['minimize']);}};return {app,calls};}
const tick=()=>new Promise(r=>setImmediate(r));

test('listener registration is acknowledged before enabling Back, with one installation',async()=>{
 const {app,calls}=fixture();let release;app.addListener=async(name,fn)=>{calls.push(['listen',name]);app.back=fn;await new Promise(r=>release=r);return {async remove(){}};};
 const c=controller(app),first=c.install(async()=>true),second=c.install(async()=>true);await tick();assert.deepEqual(calls,[['listen','backButton']]);release();assert.equal(await first,true);assert.equal(await second,true);assert.deepEqual(calls,[['listen','backButton'],['enable',true]]);
});
test('repeated Back while pause/save is pending cannot close another view or minimize',async()=>{
 const {app,calls}=fixture();let release,actions=0;const c=controller(app);await c.install(async()=>{actions++;await new Promise(r=>release=r);return true;});const first=app.back();await tick();await app.back();assert.equal(actions,1);assert.equal(calls.filter(c=>c[0]==='minimize').length,0);release();await first;
});
test('root Back awaits exactly one system minimize acknowledgement',async()=>{
 const {app,calls}=fixture();let release;app.minimizeApp=async()=>{calls.push(['minimize']);await new Promise(r=>release=r);};const c=controller(app);await c.install(async()=>false);const first=app.back();await tick();await app.back();assert.equal(calls.filter(c=>c[0]==='minimize').length,1);release();await first;
});
test('failed UI navigation reports failure, keeps foreground and permits retry',async()=>{
 const {app,calls}=fixture(),errors=[];let fail=true,actions=0;const c=controller(app,e=>errors.push(e.message));await c.install(async()=>{actions++;if(fail)throw Error('Synthetic pause refusal');return true;});await app.back();assert.deepEqual(errors,['Synthetic pause refusal']);assert.equal(calls.some(c=>c[0]==='minimize'),false);fail=false;await app.back();assert.equal(actions,2);
});
test('a failed registration never enables native Back or invokes a UI action',async()=>{
 const {app,calls}=fixture();app.addListener=async()=>{throw Error('Synthetic unavailable App listener');};const c=controller(app);await assert.rejects(c.install(async()=>true),/listener/);assert.deepEqual(calls,[]);
});
test('failed activation removes the listener and a later installation can recover',async()=>{
 const {app,calls}=fixture();let fail=true;app.toggleBackButtonHandler=async options=>{if(fail)throw Error('Synthetic activation refused');calls.push(['enable',options.enabled]);};const c=controller(app);await assert.rejects(c.install(async()=>true),/activation/);assert.equal(calls.filter(c=>c[0]==='remove').length,1);fail=false;await c.install(async()=>true);assert.equal(calls.filter(c=>c[0]==='listen').length,2);await app.back();assert.equal(calls.some(c=>c[0]==='minimize'),false);
});
