// Loaded by test runners only, never copied into the installed application's assets.
globalThis.GroveNativeScenarios=(()=>{
 const check=(value,message)=>{if(!value)throw Error(message);};
 const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 const equal=(a,b,message)=>check(canonical(a)===canonical(b),message);
 const encode=value=>{let text='';for(const byte of new TextEncoder().encode(JSON.stringify(value)))text+=String.fromCharCode(byte);return btoa(text);};
 const decode=code=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(code),c=>c.charCodeAt(0))));
 async function wait(predicate,message){const deadline=Date.now()+15000;while(!predicate()){if(Date.now()>deadline)throw Error(message);await new Promise(r=>setTimeout(r,25));}}
 async function syntheticOnly(){await GROVE_STARTED;check(GrovePlatform.persistenceReady,'Native SQLite is ready');check(!!GroveNativeTest?.database,'Internal test driver is present');const r=await GROVE_REPOSITORY.peekRegistry();check(r.list.every(p=>p.id.startsWith('synthetic-')),'Refuse to replace any non-synthetic profile');equal(Object.keys(localStorage),[],'Native child data never enters localStorage');}
 async function importFrozen(fixture){
  await syntheticOnly();const code='\ufeff\n'+encode(fixture)+'\r\n';await GROVE_REPOSITORY.importBackup(code);
  equal(decode(await backup()),fixture,'Frozen backup preserves every envelope, raw child and unknown field');
  const recovery=await GROVE_REPOSITORY.exportRecovery();check(recovery.originals.some(r=>r.code===code),'Exact original code retained');return {code,recovery};
 }
 async function practice(fixture){
  await importFrozen(fixture);PR=await GROVE_REPOSITORY.readRegistry();GROVE_SAVED_REGISTRY=groveCopy(PR);await loadS({persist:false});await home();
  const before=S.stars,unknown=groveCopy(S.futureState),cards=['狗','猫'].map(c=>ALL.find(x=>x.c===c));
  await startStudyRound('practice',{units:[],chars:['狗','猫'],modes:['listen'],limit:5},cards,cards.map(c=>['listen',c]));
  for(const card of cards){
   check(SESS.q[SESS.currentIndex][1].c===card.c,'Expected actual listen question');document.querySelector('[data-c="'+card.c+'"]').click();
   await wait(()=>!GROVE_PENDING_WRITES&&document.querySelector('#m')?.textContent.includes('You got it'),'Correct answer acknowledged only after commit');
   document.getElementById('sk').click();await wait(()=>!GROVE_PENDING_WRITES&&(!SESS||SESS.q[SESS.currentIndex][1].c!==card.c),'Advance saved');
  }
  await wait(()=>!!document.querySelector('.study-finish'),'Actual practice round finishes');
  check(S.stars===before+2,'Exactly two offline rewards');equal(S.futureState,unknown,'Active unknown fields survive practice');
  const code=await backup(),out=decode(code);check(out.data['synthetic-b']===fixture.data['synthetic-b'],'Inactive child raw bytes remain exact');
  equal(Object.keys(localStorage),[],'No localStorage after practice');return {before,after:S.stars,code};
 }
 async function diskFull(){
  const c=GroveNativeTest.connection,before=await GroveNativeTest.database.readSnapshot(),r=await GROVE_REPOSITORY.readRegistry(),p=await GROVE_REPOSITORY.readProfile(r.cur);
  const prior=(await c.query('PRAGMA max_page_count')).values[0].max_page_count,count=(await c.query('PRAGMA page_count')).values[0].page_count;
  try{
   await c.query('PRAGMA max_page_count='+count);p.syntheticOversizedField='保'.repeat(1000000);let message='';try{await GROVE_REPOSITORY.saveProfile(r.cur,p);}catch(error){message=String(error);}
   check(/full/i.test(message),'Real native driver reports SQLITE_FULL: '+message);equal(await GroveNativeTest.database.readSnapshot(),before,'Disk full preserves every acknowledged row');return message;
  }finally{await c.query('PRAGMA max_page_count='+prior);}
 }
 return {check,equal,encode,decode,syntheticOnly,importFrozen,practice,diskFull};
})();
