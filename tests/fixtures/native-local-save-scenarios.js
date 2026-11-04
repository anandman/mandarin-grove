// Test-runner injection only. Never packaged as a production app asset.
globalThis.GroveLocalSaveScenario=(()=>{
 const originalFetch=fetch.bind(globalThis);let externalAttempts=0;
 globalThis.fetch=(input,...args)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.protocol!==location.protocol||url.hostname!==location.hostname){externalAttempts++;throw Error('External request blocked during local-save smoke');}return originalFetch(input,...args);};
 const check=(ok,message)=>{if(!ok)throw Error(message);},copy=v=>JSON.parse(JSON.stringify(v));
 const canonical=v=>JSON.stringify(v,(_k,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.keys(row).sort().map(k=>[k,row[k]])):row);
 const equal=(a,b,message)=>check(canonical(a)===canonical(b),message);
 const decode=code=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(code),c=>c.charCodeAt(0))));
 async function ready(){await GROVE_STARTED;check(GrovePlatform.persistenceReady,'Actual native SQLite is ready');check(['ios','android'].includes(GrovePlatform.platform),'Actual native platform required');equal(Object.keys(localStorage),[],'No browser learner storage');}
 async function persisted(){equal(await GROVE_REPOSITORY.peekProfile(PR.cur),S,'Visible progress equals acknowledged native save');}
 function verifyOwner(context){check(PR.cur===context.profileId&&S.futureLocalSmoke?.marker===context.marker,'Only the newly created synthetic profile may change');}
 async function preserve(){await ready();const priorRegistry=await GROVE_REPOSITORY.peekRegistry();check(priorRegistry.list.every(p=>p.id.startsWith('synthetic-')),'Refuse non-synthetic existing profiles');return {priorRegistry,priorCode:await backup(),priorOriginals:(await GROVE_REPOSITORY.exportRecovery()).originals,priorReports:await GROVE_REPOSITORY.readReports()};}
 async function begin(expectedVersion){
  await ready();const priorRegistry=await GROVE_REPOSITORY.peekRegistry();check(priorRegistry.list.every(p=>p.id.startsWith('synthetic-')),'Refuse non-synthetic existing profiles');
  check((await(await fetch('version.txt')).text()).trim()===expectedVersion,'Installed asset version matches current source');
  const context={...await preserve(),marker:'synthetic-local-save-'+Date.now()};
  const created=await GROVE_REPOSITORY.createProfile({name:'Native local QA',av:'🐳',gr:'2'});context.profileId=created.id;
  PR=await GROVE_REPOSITORY.readRegistry();PR.cur=created.id;await savePR();await loadS();await home();await stopSpeech();
  S.futureLocalSmoke={marker:context.marker,raw:['绿\r\n',null,{future:true}]};S.rewards??={version:1,characters:{},ribbons:0,achievements:{}};S.rewards.ribbons=20;refreshGroveWallet(S);S.groveRewards.futureLocal={bytes:'keep\ufeff\r\n'};await save();check(S.groveRewards.balance===20,'Synthetic local starting balance');
  await groveUnlock('violet-leaves');check(S.groveRewards.balance===17&&S.groveRewards.owned.includes('violet-leaves'),'Offline unlock uses original price and ordinary save');await persisted();
  context.purchaseId=S.groveRewards.transactions.at(-1).id;context.afterPurchase=copy(S);return context;
 }
 async function afterPurchaseRestart(context){
  await ready();verifyOwner(context);equal(S,context.afterPurchase,'Purchase, all progress and unknown fields survive native process restart');
  await groveUnlock('violet-leaves');equal(S,context.afterPurchase,'Repeated unlock does not charge again');
  await groveUndo(context.purchaseId);check(S.groveRewards.balance===20&&!S.groveRewards.owned.includes('violet-leaves'),'Offline Undo refunds original price');await groveUndo(context.purchaseId);check(S.groveRewards.balance===20,'Repeated Undo cannot refund twice');
  S.groveRewards.projects['reading-nook']={stage:0,visible:false,futureLocal:{raw:['preserve','绿',null]}};await save();
  await groveBuild('reading-nook');context.firstBuildId=S.groveRewards.transactions.at(-1).id;check(S.groveRewards.balance===18&&S.groveRewards.projects['reading-nook'].stage===1,'First stage price');
  equal(S.groveRewards.projects['reading-nook'].futureLocal,{raw:['preserve','绿',null]},'Building retains nested unknown project fields');
  // Real clock instants distinguish the existing ordinary receipt IDs.
  await new Promise(resolve=>setTimeout(resolve,2));await groveBuild('reading-nook');context.secondBuildId=S.groveRewards.transactions.at(-1).id;check(S.groveRewards.balance===15&&S.groveRewards.projects['reading-nook'].stage===2,'Second stage price');
  await groveUndo(context.firstBuildId);check(S.groveRewards.balance===15,'Cannot remove a predecessor while a later stage exists');
  await groveUndo(context.secondBuildId);check(S.groveRewards.balance===18&&S.groveRewards.projects['reading-nook'].stage===1,'Current piece refunds once');await persisted();context.afterBuild=copy(S);context.currentCode=await backup();return context;
 }
 async function restore(context){
  await ready();const original=decode(context.priorCode),current=decode(await backup());
  // The opaque original code retains JSON member order across XCTest's
  // dictionary bridge. Raw profile payloads remain exact strings below.
  if(canonical(current)!==canonical(original)){verifyOwner(context);PR=copy(original.PR);await savePR();}
  else PR=copy(current.PR);
  await loadS({persist:false});who();
  const restoredCode=await backup();equal(decode(restoredCode),original,'Original registry/envelope values and raw profile bytes unchanged');equal((await GROVE_REPOSITORY.exportRecovery()).originals,context.priorOriginals,'Exact prior imported originals unchanged');equal(await GROVE_REPOSITORY.readReports(),context.priorReports,'Private raw reports unchanged');
  return {restoredOriginalBackupSemanticsExact:true,originalProfileBytesExact:true,exportedBackupByteIdentical:restoredCode===context.priorCode,originalImportsExact:true,reportsExact:true,retainedSyntheticProfileId:context.profileId};
 }
 async function finish(context){
  await ready();verifyOwner(context);equal(S,context.afterBuild,'Build, refund and unknown fields survive second native process restart');
  await groveUndo(context.secondBuildId);equal(S,context.afterBuild,'A refunded receipt stays refunded across restart');await persisted();const restored=await restore(context);
  check(externalAttempts===0,'Local save operations need no external request');return {...restored,passed:true,platform:GrovePlatform.platform,localUnlock:true,originalPriceRefund:true,stagedBuild:true,idempotentRetryAfterRestart:true,unknownFields:true,externalFetchBlocked:true,externalAttempts,noBrowserStorage:Object.keys(localStorage).length===0};
 }
 return {begin,afterPurchaseRestart,finish,restore,preserve};
})();
