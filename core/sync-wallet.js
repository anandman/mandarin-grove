/* Pure wallet facts projected from validated sync operations, not a provider wire/auth validator.
   Original operation bytes, earning policy and account/DAG validation belong to the operation store. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GroveSyncWallet=api;})(globalThis,()=>{
 'use strict';
 const MAX=Number.MAX_SAFE_INTEGER,kinds=new Set(['credit','purchase','refund','legacyGrant']);
 function fail(code){const error=Error('Grove wallet action unavailable: '+code);error.code=code;throw error;}
 const id=value=>typeof value==='string'&&/^[A-Za-z0-9_.:/-]{1,200}$/.test(value);
 const lotId=value=>typeof value==='string'&&(value.startsWith('refund:')?id(value.slice(7)):id(value));
 const integer=(value,min=0)=>Number.isSafeInteger(value)&&value>=min;
 function canonical(value,stack=new Set()){
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'){if(!Number.isFinite(value))fail('WALLET_INPUT');return JSON.stringify(value);}
  if(typeof value!=='object'||stack.has(value)||Object.getOwnPropertySymbols(value).length)fail('WALLET_INPUT');
  const prototype=Object.getPrototypeOf(value);if(!Array.isArray(value)&&prototype!==null&&prototype!==Object.prototype)fail('WALLET_INPUT');
  stack.add(value);let result;
  if(Array.isArray(value))result='['+Array.from(value,item=>canonical(item,stack)).join(',')+']';
  else result='{'+Object.keys(value).sort().map(key=>{const field=Object.getOwnPropertyDescriptor(value,key);if(!field||!Object.hasOwn(field,'value'))fail('WALLET_INPUT');return JSON.stringify(key)+':'+canonical(field.value,stack);}).join(',')+'}';
  stack.delete(value);return result;
 }
 const copy=value=>JSON.parse(canonical(value));
 const validScope=value=>!!value&&typeof value==='object'&&id(value.namespace)&&id(value.profileUuid);
 const sameScope=(a,b)=>a.namespace===b.namespace&&a.profileUuid===b.profileUuid;
 function target(value){
  if(!value||!['reward','project'].includes(value.kind)||!id(value.id))fail('WALLET_TARGET');
  if(value.kind==='project'){if(!integer(value.stage,1))fail('WALLET_TARGET');return {kind:'project',id:value.id,stage:value.stage};}
  if(value.stage!==undefined)fail('WALLET_TARGET');return {kind:'reward',id:value.id};
 }
 const targetKey=value=>JSON.stringify([value.kind,value.id,value.stage??0]);
 const groupKey=value=>JSON.stringify([targetKey(value.target),value.cycle]);
 const sorted=values=>[...values].sort((a,b)=>a<b?-1:a>b?1:0);
 function createWallet({priceBooks,currentPriceVersion}){
  const books=new Map();
  for(const [version,raw]of Object.entries(copy(priceBooks))){
   if(!integer(Number(version),1)||String(Number(version))!==version||!Array.isArray(raw.rewards)||!Array.isArray(raw.projects))fail('WALLET_PRICE');
   const rewards=new Map(),projects=new Map();
   for(const reward of raw.rewards){if(!id(reward.id)||!integer(reward.cost)||rewards.has(reward.id))fail('WALLET_PRICE');rewards.set(reward.id,reward.cost);}
   for(const project of raw.projects){if(!id(project.id)||!Array.isArray(project.stages)||projects.has(project.id)||project.stages.some(p=>!integer(p.cost)))fail('WALLET_PRICE');projects.set(project.id,project.stages.map(p=>p.cost));}
   books.set(Number(version),{rewards,projects});
  }
  if(!integer(currentPriceVersion,1)||!books.has(currentPriceVersion))fail('WALLET_PRICE');
  function quote(value,version=currentPriceVersion){
   const t=target(value),book=books.get(version),cost=t.kind==='reward'?book?.rewards.get(t.id):book?.projects.get(t.id)?.[t.stage-1];
   if(!integer(cost))fail('WALLET_PRICE');return cost;
  }
  function analyse(input){
   if(!input||!validScope(input.scope)||!Array.isArray(input.facts)||!Array.isArray(input.acknowledgedIds)||input.acknowledgedIds.some(v=>!id(v)))fail('WALLET_INPUT');
   const scope={namespace:input.scope.namespace,profileUuid:input.scope.profileUuid},ack=new Set(input.acknowledgedIds);
   const rows=input.facts.map(value=>{const text=canonical(value);return {raw:JSON.parse(text),text};}).sort((a,b)=>a.text<b.text?-1:a.text>b.text?1:0);
   const retained=rows.map(row=>row.raw),allIds=new Map(),variants=new Map(),rejected=[],conflicts=[],pending=[];
   const lots=new Map(),resolved=new Map(),candidates=new Map();
   const reject=(row,code)=>rejected.push({id:id(row.raw?.id)?row.raw.id:null,code});
   for(const row of rows){
    const raw=row.raw;
    if(raw&&id(raw.id)){const all=allIds.get(raw.id)||[];all.push(row);allIds.set(raw.id,all);}
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||!validScope(raw.scope)||!id(raw.id)){reject(row,'INVALID_FACT');continue;}
    if(!sameScope(raw.scope,scope))continue;
    const set=variants.get(raw.id)||new Map();set.set(row.text,row);variants.set(raw.id,set);
   }
   for(const [factId,set]of variants){
    if(set.size>1){conflicts.push({id:factId,variants:[...set.values()].map(row=>row.raw)});continue;}
    const row=[...set.values()][0],raw=row.raw;
    try{
     if(raw.schema!==1||!kinds.has(raw.kind))fail('UNSUPPORTED_FACT');
     if(raw.kind==='credit'){
      if(!integer(raw.amount)||raw.id.startsWith('refund:'))fail('INVALID_CREDIT');
      lots.set(raw.id,{id:raw.id,amount:raw.amount,sourceKind:'credit',sourceId:raw.id});resolved.set(raw.id,{...raw});continue;
     }
     if(raw.kind==='legacyGrant'){
      if(!integer(raw.refundableCost)||raw.cycle!==undefined&&raw.cycle!==0)fail('INVALID_GRANT');
      resolved.set(raw.id,{id:raw.id,kind:raw.kind,target:target(raw.target),cycle:0,cost:raw.refundableCost,claims:[]});continue;
     }
     let candidate;
     if(raw.kind==='purchase'){
      const t=target(raw.target);
      if(!integer(raw.cycle)||!integer(raw.priceVersion,1)||raw.cost!==quote(t,raw.priceVersion)||!Array.isArray(raw.claims))fail('INVALID_PURCHASE');
      if(raw.cycle===0?raw.afterRefund!==undefined:!id(raw.afterRefund))fail('INVALID_CYCLE');
      const claims=[],seen=new Set();let sum=0;
      for(const claim of raw.claims){if(!claim||!lotId(claim.creditId)||!integer(claim.amount,1)||seen.has(claim.creditId))fail('INVALID_CLAIM');if(claim.amount>raw.cost-sum)fail('INVALID_CLAIM');seen.add(claim.creditId);sum+=claim.amount;claims.push({creditId:claim.creditId,amount:claim.amount});}
      if(sum!==raw.cost)fail('INVALID_CLAIM');
      if(t.kind==='project'&&t.stage>1){if(!id(raw.previousStageId))fail('INVALID_STAGE');}
      else if(raw.previousStageId!==undefined)fail('INVALID_STAGE');
      candidate={id:raw.id,kind:raw.kind,target:t,cycle:raw.cycle,cost:raw.cost,priceVersion:raw.priceVersion,claims,...(raw.afterRefund===undefined?{}:{afterRefund:raw.afterRefund}),...(raw.previousStageId===undefined?{}:{previousStageId:raw.previousStageId})};
     }else{
      if(!id(raw.purchaseId)||!Array.isArray(raw.removes)||!raw.removes.length||raw.removes.some(v=>!id(v))||new Set(raw.removes).size!==raw.removes.length||!raw.removes.includes(raw.purchaseId))fail('INVALID_REFUND');
      candidate={id:raw.id,kind:raw.kind,purchaseId:raw.purchaseId,removes:[...raw.removes]};
     }
     if(!ack.has(raw.id)){pending.push(raw.id);continue;}
     candidates.set(raw.id,{candidate,row});
    }catch(error){reject(row,error.code||'INVALID_FACT');}
   }
   // Resolve dependencies in a work queue; no clock ordering and no repeated whole-log scan.
   const queue=sorted(candidates.keys()),unresolved=new Set(queue),dependencies=new Map(),listeners=new Map();
   function waitFor(factId,keys){
    const missing=new Set(keys);dependencies.set(factId,missing);
    for(const key of missing){const waiting=listeners.get(key)||new Set();waiting.add(factId);listeners.set(key,waiting);}
   }
   function available(key){
    for(const factId of listeners.get(key)||[]){const missing=dependencies.get(factId);if(!missing)continue;missing.delete(key);if(!missing.size){dependencies.delete(factId);queue.push(factId);}}
    listeners.delete(key);
   }
   for(let at=0;at<queue.length;at++){
    const factId=queue[at];if(!unresolved.has(factId))continue;
    const {candidate:c,row}=candidates.get(factId);
    const keys=c.kind==='purchase'?[...c.claims.filter(v=>!lots.has(v.creditId)).map(v=>'lot:'+v.creditId),...(['afterRefund','previousStageId'].filter(k=>c[k]&&!resolved.has(c[k])).map(k=>'fact:'+c[k]))]:[...new Set([c.purchaseId,...c.removes])].filter(v=>!resolved.has(v)).map(v=>'fact:'+v);
    if(keys.length){waitFor(factId,keys);continue;}
    unresolved.delete(factId);
    try{
     if(c.kind==='purchase'){
      for(const claim of c.claims){
       const lot=lots.get(claim.creditId);if(claim.amount>lot.amount)fail('INVALID_CLAIM');
       if(lot.sourceKind==='refund'){const source=resolved.get(lot.sourceId);if(targetKey(source.target)===targetKey(c.target)&&source.cycle>=c.cycle)fail('INVALID_CYCLE');}
      }
      if(c.afterRefund){const parent=resolved.get(c.afterRefund);if(parent?.kind!=='refund'||targetKey(parent.target)!==targetKey(c.target)||parent.cycle!==c.cycle-1)fail('INVALID_CYCLE');}
      if(c.target.kind==='project'&&c.target.stage>1){const parent=resolved.get(c.previousStageId);if(!['purchase','legacyGrant'].includes(parent?.kind)||parent.target.kind!=='project'||parent.target.id!==c.target.id||parent.target.stage!==c.target.stage-1)fail('INVALID_STAGE');}
      resolved.set(c.id,c);
     }else{
      const source=resolved.get(c.purchaseId);
      if(!['purchase','legacyGrant'].includes(source?.kind))fail('INVALID_REFUND');
      for(const removed of c.removes){const prior=resolved.get(removed);if(!['purchase','legacyGrant'].includes(prior?.kind)||targetKey(prior.target)!==targetKey(source.target)||prior.cycle>source.cycle)fail('INVALID_REFUND');}
      const lotId='refund:'+c.purchaseId;
      if(lots.has(lotId)&&lots.get(lotId).amount!==source.cost)fail('CONFLICTED_REFUND');
      if(!lots.has(lotId)){lots.set(lotId,{id:lotId,amount:source.cost,sourceKind:'refund',sourceId:c.purchaseId});available('lot:'+lotId);}
      resolved.set(c.id,{...c,target:source.target,cycle:source.cycle});
     }
     available('fact:'+c.id);
    }catch(error){reject(row,error.code||'INVALID_DEPENDENCY');}
   }
   const removed=new Set(),refunds=[];
   for(const row of resolved.values())if(row.kind==='refund'){row.removes.forEach(v=>removed.add(v));refunds.push(row);}
   const receipts=[...resolved.values()].filter(row=>['purchase','legacyGrant'].includes(row.kind)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
   const groups=new Map();
   for(const row of receipts){const key=groupKey(row),group=groups.get(key)||[];group.push(row);groups.set(key,group);}
   const spent=new Map(),groupViews=[];
   for(const key of sorted(groups.keys())){
    const members=groups.get(key).sort((a,b)=>(a.kind==='legacyGrant'?0:1)-(b.kind==='legacyGrant'?0:1)||(a.id<b.id?-1:a.id>b.id?1:0)),first=members[0];
    if(first.kind==='purchase')for(const claim of first.claims){const used=spent.get(claim.creditId)||0,limit=lots.get(claim.creditId).amount;spent.set(claim.creditId,used+Math.min(claim.amount,limit-used));}
    groupViews.push({target:copy(first.target),cycle:first.cycle,canonicalId:first.id,cost:first.cost,receiptIds:sorted(members.map(v=>v.id))});
   }
   let total=0;
   const lotViews=sorted(lots.keys()).map(key=>{const lot=lots.get(key),used=spent.get(key)||0,remaining=lot.amount-used;if(remaining>MAX-total)fail('WALLET_OVERFLOW');total+=remaining;return {...lot,spent:used,available:remaining};});
   const owned=new Set(),projects=new Map();
   for(const receipt of receipts)if(!removed.has(receipt.id)){
    const t=receipt.target;if(t.kind==='reward')owned.add(t.id);else projects.set(t.id,Math.max(projects.get(t.id)||0,t.stage));
   }
   rejected.sort((a,b)=>canonical(a)<canonical(b)?-1:canonical(a)>canonical(b)?1:0);conflicts.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
   const waiting=sorted(unresolved),pendingIds=sorted(new Set(pending));
   const status=rejected.length||conflicts.length?'needs-recovery':waiting.length?'incomplete':pendingIds.length?'pending':'ready';
   const view={scope,status,canPurchase:status==='ready',balance:total,lots:lotViews,owned:sorted(owned),projects:Object.fromEntries(sorted(projects.keys()).map(key=>[key,{stage:projects.get(key)}])),groups:groupViews,receipts:receipts.map(row=>({...copy(row),refunded:removed.has(row.id)})),refunds:refunds.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(copy),pending:pendingIds,waiting,rejected,conflicts,retained};
   return {view,allIds};
  }
  function existing(a,request,kind,match){
   if(!request||!id(request.id))fail('WALLET_INPUT');
   const rows=a.allIds.get(request.id);if(!rows)return;
   if(new Set(rows.map(row=>row.text)).size!==1||!validScope(rows[0].raw.scope)||!sameScope(rows[0].raw.scope,a.view.scope)||rows[0].raw.kind!==kind||!match(rows[0].raw))fail('WALLET_REQUEST_REUSED');
   if(a.view.rejected.some(row=>row.id===request.id)||a.view.conflicts.some(row=>row.id===request.id))fail('WALLET_NOT_READY');return copy(rows[0].raw);
  }
  function ready(a,request){if(request.online!==true)fail('WALLET_OFFLINE');if(!a.view.canPurchase)fail('WALLET_NOT_READY');}
  function preparePurchase(input,request){
   const a=analyse(input),t=target(request?.target),old=existing(a,request,'purchase',raw=>targetKey(target(raw.target))===targetKey(t));if(old)return old;
   ready(a,request);const cost=quote(t);
   if(t.kind==='reward'&&a.view.owned.includes(t.id))fail('WALLET_OWNED');
   if(t.kind==='project'&&t.stage!==(Object.hasOwn(a.view.projects,t.id)?a.view.projects[t.id].stage:0)+1)fail('WALLET_STAGE');
   if(a.view.balance<cost)fail('WALLET_INSUFFICIENT');
   const history=a.view.receipts.filter(row=>targetKey(row.target)===targetKey(t)),cycle=history.length?history.reduce((max,row)=>Math.max(max,row.cycle),-1)+1:0;
   if(!integer(cycle))fail('WALLET_OVERFLOW');
   const parent=cycle?a.view.refunds.find(row=>targetKey(row.target)===targetKey(t)&&row.cycle===cycle-1):null;if(cycle&&!parent)fail('WALLET_NOT_READY');
   let left=cost;const claims=[];for(const lot of a.view.lots){if(!left)break;const amount=Math.min(left,lot.available);if(amount){claims.push({creditId:lot.id,amount});left-=amount;}}
   const previous=t.kind==='project'&&t.stage>1?a.view.receipts.find(row=>!row.refunded&&row.target.kind==='project'&&row.target.id===t.id&&row.target.stage===t.stage-1):null;
   if(t.kind==='project'&&t.stage>1&&!previous)fail('WALLET_STAGE');
   return {schema:1,kind:'purchase',id:request.id,scope:copy(a.view.scope),target:t,cycle,priceVersion:currentPriceVersion,cost,claims,...(parent?{afterRefund:parent.id}:{}),...(previous?{previousStageId:previous.id}:{})};
  }
  function prepareRefund(input,request){
   const a=analyse(input),old=existing(a,request,'refund',raw=>raw.purchaseId===request.purchaseId);if(old)return old;
   ready(a,request);if(!id(request.purchaseId))fail('WALLET_INPUT');
   const source=a.view.receipts.find(row=>row.id===request.purchaseId);if(!source||source.refunded)fail('WALLET_REFUND');
   if(source.target.kind==='project'&&a.view.projects[source.target.id]?.stage!==source.target.stage)fail('WALLET_STAGE');
   const removes=a.view.receipts.filter(row=>!row.refunded&&targetKey(row.target)===targetKey(source.target)&&row.cycle<=source.cycle).map(row=>row.id);
   return {schema:1,kind:'refund',id:request.id,scope:copy(a.view.scope),purchaseId:source.id,removes:sorted(removes)};
  }
  return Object.freeze({quote,project:input=>analyse(input).view,preparePurchase,prepareRefund});
 }
 return {createWallet};
});
