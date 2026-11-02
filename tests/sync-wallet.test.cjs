const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let createWallet;try{({createWallet}=require('../core/sync-wallet.js'));}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
const scope={namespace:'synthetic-account-a',profileUuid:'synthetic-profile-a'};
const target=id=>({kind:'reward',id}),piece=stage=>({kind:'project',id:'project',stage});
const book={rewards:[{id:'a',cost:80},{id:'b',cost:80},{id:'free',cost:0}],projects:[{id:'project',stages:[{cost:30},{cost:40}]}]};
function wallet(){assert.equal(typeof createWallet,'function','A real deterministic native wallet core is required');return createWallet({priceBooks:{1:book},currentPriceVersion:1});}
const fact=(kind,id,extra={})=>({schema:1,kind,id,scope:{...scope},...extra});
const credit=(id,amount,extra={})=>fact('credit',id,{amount,...extra});
const input=(facts,acknowledgedIds=[])=>({scope,facts,acknowledgedIds});
function buy(w,facts,id,idTarget='a',ack=[]){return w.preparePurchase(input(facts,ack),{id,target:typeof idTarget==='string'?target(idTarget):idTarget,online:true});}
function permutations(items){if(items.length<2)return [items];return items.flatMap((item,i)=>permutations(items.filter((_,j)=>j!==i)).map(rest=>[item,...rest]));}
const frozen=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))frozen(v);}return value;};
const code=expected=>e=>e.code===expected;

test('concurrent distinct cosmetics keep both unlocks without debt against new earnings in every delivery order',()=>{
 const w=wallet(),c=credit('earned-1',100),a=buy(w,[c],'buy-a','a'),b=buy(w,[c],'buy-b','b'),later=credit('earned-later',20);
 for(const rows of permutations([c,a,b,later])){
  const p=w.project(input(rows,[a.id,b.id]));assert.equal(p.status,'ready');assert.equal(p.balance,20);assert.deepEqual(p.owned,['a','b']);assert.equal(p.lots.find(l=>l.id===c.id).available,0);assert.equal(p.lots.find(l=>l.id===later.id).available,20);
 }
});
test('old claims cannot consume an unseen concurrent credit lot or depend on timestamps',()=>{
 const w=wallet(),c=credit('credit',100,{at:999999}),a=buy(w,[c],'buy-a'),b=buy(w,[c],'buy-b','b');
 a.at=1;b.at=-100;const fresh=credit('new',37,{at:-999999});assert.equal(w.project(input([a,b,c,fresh],[a.id,b.id])).balance,37);
});
test('saving an unacknowledged purchase preserves balance and does not unlock it',()=>{
 const w=wallet(),c=credit('credit',100),p=buy(w,[c],'pending');const v=w.project(input([c,p]));assert.equal(v.balance,100);assert.deepEqual(v.owned,[]);assert.deepEqual(v.pending,['pending']);assert.equal(v.canPurchase,false);
 const ready=w.project(input([c,p],[p.id]));assert.equal(ready.balance,20);assert.deepEqual(ready.owned,['a']);
});
test('same request retry retains exact claims and unknown fields after earning or disconnection',()=>{
 const w=wallet(),c=credit('credit',100),p=buy(w,[c],'same');p.future={keep:['raw',true]};const rows=frozen([c,p,credit('new',20)]);
 assert.deepEqual(w.preparePurchase(input(rows),{id:p.id,target:target('a'),online:false}),p);
 assert.throws(()=>w.preparePurchase(input(rows),{id:p.id,target:target('b'),online:true}),code('WALLET_REQUEST_REUSED'));
});
test('duplicate purchase and duplicate same-entitlement receipts charge once, retain all raw variants',()=>{
 const w=wallet(),c=credit('credit',100),a=buy(w,[c],'a-receipt'),b=buy(w,[c],'b-receipt');const rows=frozen([c,a,a,b]);const p=w.project(input(rows,[a.id,b.id,a.id]));assert.equal(p.balance,20);assert.deepEqual(p.owned,['a']);assert.equal(p.retained.length,4);assert.equal(p.groups.length,1);assert.deepEqual(p.groups[0].receiptIds,['a-receipt','b-receipt']);
});
test('divergent immutable IDs are recoverable conflicts, never first-arrival wins',()=>{
 const w=wallet(),a=credit('same',100,{future:{left:1}}),b=credit('same',100,{future:{right:2}});
 for(const rows of [[a,b],[b,a]]){const p=w.project(input(rows));assert.equal(p.balance,0);assert.equal(p.status,'needs-recovery');assert.equal(p.canPurchase,false);assert.equal(p.conflicts.length,1);assert.equal(p.conflicts[0].variants.length,2);assert.equal(p.retained.length,2);}
});
test('a lost receipt followed by refund/rebuy replays without a second debit or refund',()=>{
 const w=wallet(),c=credit('credit',100),a=buy(w,[c],'buy');const r=w.prepareRefund(input([c,a],[a.id]),{id:'undo',purchaseId:a.id,online:true});
 const unacked=w.project(input([c,a,r],[a.id]));assert.equal(unacked.balance,20);assert.deepEqual(unacked.owned,['a']);
 const after=w.project(input([c,a,r],[a.id,r.id]));assert.equal(after.balance,100);assert.deepEqual(after.owned,[]);
 const b=buy(w,[c,a,r],'rebuy','a',[a.id,r.id]);assert.equal(b.cycle,1);assert.equal(b.afterRefund,r.id);
 for(const rows of permutations([c,a,r,b])){const p=w.project(input(rows,[a.id,r.id,b.id]));assert.equal(p.balance,20);assert.deepEqual(p.owned,['a']);}
 const again=w.project(input([c,a,r,r,b],[a.id,r.id,b.id]));assert.equal(again.balance,20);
});
test('two distinct overlapping purchases and full-price Undo may grant bonus cosmetic oranges, never duplicate a refund',()=>{
 const w=wallet(),c=credit('credit',100),a=buy(w,[c],'a','a'),b=buy(w,[c],'b','b');const ack=[a.id,b.id],ra=w.prepareRefund(input([c,a,b],ack),{id:'undo-a',purchaseId:a.id,online:true}),rb=w.prepareRefund(input([c,a,b],ack),{id:'undo-b',purchaseId:b.id,online:true});
 const p=w.project(input([c,a,b,ra,rb,ra,credit('later',20)],[...ack,ra.id,rb.id]));assert.equal(p.balance,180);assert.deepEqual(p.owned,[]);assert.equal(p.lots.filter(l=>l.id==='refund:'+a.id).length,1);assert.equal(p.lots.find(l=>l.id==='later').available,20);
});
test('Undo removes observed duplicate additions but keeps a previously unseen concurrent unlock',()=>{
 const w=wallet(),c=credit('credit',100),a=buy(w,[c],'a'),b=buy(w,[c],'b');const r=w.prepareRefund(input([c,a],[a.id]),{id:'undo',purchaseId:a.id,online:true});
 const p=w.project(input([c,a,b,r],[a.id,b.id,r.id]));assert.deepEqual(p.owned,['a']);assert.equal(p.balance,100);
 const observed=w.prepareRefund(input([c,a,b],[a.id,b.id]),{id:'undo-observed',purchaseId:a.id,online:true});assert.deepEqual(observed.removes,[a.id,b.id]);assert.deepEqual(w.project(input([c,a,b,observed],[a.id,b.id,observed.id])).owned,[]);
});
test('different refund requests for the same original receipt produce one stable credit lot',()=>{
 const w=wallet(),c=credit('credit',100),a=buy(w,[c],'buy');const r=w.prepareRefund(input([c,a],[a.id]),{id:'undo-one',purchaseId:a.id,online:true}),r2={...r,id:'undo-two'};
 const p=w.project(input([c,a,r,r2],[a.id,r.id,r2.id]));assert.equal(p.balance,100);assert.equal(p.lots.filter(l=>l.id==='refund:buy').length,1);
});
test('old Undo cannot remove a later rebuy or claim its future credit',()=>{
 const w=wallet(),c=credit('credit',100),a=buy(w,[c],'buy'),r=w.prepareRefund(input([c,a],[a.id]),{id:'undo',purchaseId:a.id,online:true}),b=buy(w,[c,a,r],'new-buy','a',[a.id,r.id]);
 const forged={...r,id:'bad-undo',removes:[a.id,b.id]};const p=w.project(input([c,a,r,b,forged],[a.id,r.id,b.id,forged.id]));assert.deepEqual(p.owned,['a']);assert.equal(p.status,'needs-recovery');assert.ok(p.rejected.some(x=>x.id===forged.id));
});
test('legacy entitlement grants preserve paid Undo cost without charging the baseline again',()=>{
 const w=wallet(),c=credit('legacy-balance',7),g=fact('legacyGrant','legacy-owned',{target:target('a'),refundableCost:19,future:{receipt:'keep'}});const r=w.prepareRefund(input([c,g]),{id:'undo-legacy',purchaseId:g.id,online:true});
 assert.equal(w.project(input([c,g])).balance,7);const p=w.project(input([c,g,r],[r.id]));assert.equal(p.balance,26);assert.deepEqual(p.owned,[]);assert.deepEqual(p.retained.find(x=>x.id===g.id).future,g.future);
});
test('refund price comes from the validated original receipt after the current catalog price changes',()=>{
 const w=wallet(),c=credit('credit',100),a=buy(w,[c],'old');const updated=createWallet({priceBooks:{1:book,2:{...book,rewards:book.rewards.map(r=>({...r,cost:r.id==='a'?90:r.cost}))}},currentPriceVersion:2});
 const r=updated.prepareRefund(input([c,a],[a.id]),{id:'refund',purchaseId:a.id,online:true});assert.equal(updated.project(input([c,a,r],[a.id,r.id])).balance,100);
});
test('project pieces require the next stage, keep completed pieces and restrict normal Undo to the last stage',()=>{
 const w=wallet(),c=credit('credit',100);assert.throws(()=>buy(w,[c],'skip',piece(2)),code('WALLET_STAGE'));
 const a=buy(w,[c],'stage-one',piece(1)),b=buy(w,[c,a],'stage-two',piece(2),[a.id]);const facts=[c,a,b],ack=[a.id,b.id];assert.equal(w.project(input(facts,ack)).projects.project.stage,2);
 assert.throws(()=>w.prepareRefund(input(facts,ack),{id:'old',purchaseId:a.id,online:true}),code('WALLET_STAGE'));
 const r=w.prepareRefund(input(facts,ack),{id:'last',purchaseId:b.id,online:true});const p=w.project(input([...facts,r],[...ack,r.id]));assert.equal(p.projects.project.stage,1);assert.equal(p.balance,70);
});
test('late concurrent earlier-stage Undo cannot discard an already built later piece',()=>{
 const w=wallet(),c=credit('credit',100),a=buy(w,[c],'stage-one',piece(1)),b=buy(w,[c,a],'stage-two',piece(2),[a.id]),r=w.prepareRefund(input([c,a],[a.id]),{id:'older-undo',purchaseId:a.id,online:true});
 const p=w.project(input([c,a,b,r],[a.id,b.id,r.id]));assert.equal(p.projects.project.stage,2);assert.equal(p.balance,60);
});
test('online acknowledgement is required only for purchases/refunds; credits remain available offline',()=>{
 const w=wallet(),c=credit('credit',100);assert.equal(w.project(input([c])).balance,100);assert.throws(()=>w.preparePurchase(input([c]),{id:'offline',target:target('a'),online:false}),code('WALLET_OFFLINE'));
 const a=buy(w,[c],'buy');assert.throws(()=>w.prepareRefund(input([c,a],[a.id]),{id:'off-undo',purchaseId:a.id,online:false}),code('WALLET_OFFLINE'));
});
test('insufficient funds, unknown prices and owned targets never mutate the original facts',()=>{
 const w=wallet(),facts=frozen([credit('credit',20)]),before=JSON.stringify(facts);assert.throws(()=>buy(w,facts,'poor'),code('WALLET_INSUFFICIENT'));assert.throws(()=>buy(w,facts,'unknown','missing'),code('WALLET_PRICE'));assert.equal(JSON.stringify(facts),before);
 const c=credit('enough',100),a=buy(w,[c],'a');assert.throws(()=>buy(w,[c,a],'again','a',[a.id]),code('WALLET_OWNED'));
});
test('scope isolation rejects request-ID reuse across a different account or child',()=>{
 const w=wallet(),c=credit('own',100),foreign=credit('foreign',999,{scope:{...scope,namespace:'another-account'}}),sibling=credit('sibling',999,{scope:{...scope,profileUuid:'another-child'}});
 assert.equal(w.project(input([c,foreign,sibling])).balance,100);assert.throws(()=>buy(w,[c,foreign],'foreign'),code('WALLET_REQUEST_REUSED'));assert.equal(w.project(input([foreign,sibling])).balance,0);
});
test('missing credit, source receipt and cyclic dependencies stay recoverable and block buying',()=>{
 const w=wallet(),p=fact('purchase','missing',{target:target('a'),cycle:0,priceVersion:1,cost:80,claims:[{creditId:'absent',amount:80}]});const a=w.project(input([p],[p.id]));assert.equal(a.balance,0);assert.equal(a.canPurchase,false);assert.deepEqual(a.waiting,[p.id]);assert.equal(a.retained.length,1);
 const x={...p,id:'x',claims:[{creditId:'refund:y',amount:80}]},y={...p,id:'y',target:target('b'),claims:[{creditId:'refund:x',amount:80}]},rx=fact('refund','rx',{purchaseId:'x',removes:['x']}),ry=fact('refund','ry',{purchaseId:'y',removes:['y']});const cyclic=w.project(input([x,y,rx,ry],['x','y','rx','ry']));assert.equal(cyclic.balance,0);assert.equal(cyclic.waiting.length,4);
});
test('future schemas, kinds and price books are retained without pretending that buying is safe',()=>{
 const w=wallet(),c=credit('credit',100),unknowns=[{...credit('future',10),schema:2},fact('future-wallet-kind','new-kind',{privateFuture:{keep:true}}),fact('purchase','future-price',{target:target('a'),cycle:0,priceVersion:99,cost:80,claims:[{creditId:c.id,amount:80}]})];
 for(const x of unknowns){const p=w.project(input([c,x],[x.id]));assert.equal(p.balance,100);assert.equal(p.canPurchase,false);assert.deepEqual(p.retained.find(row=>row.id===x.id),x);assert.equal(p.rejected.length,1);}
});
test('invalid claims and costs cannot mint oranges, remove valid facts or spend another lot',()=>{
 const w=wallet(),c=credit('credit',100),a=buy(w,[c],'buy');for(const change of [{cost:79},{claims:[{creditId:c.id,amount:-80}]},{claims:[{creditId:c.id,amount:101}]},{claims:[{creditId:c.id,amount:40},{creditId:c.id,amount:40}]},{claims:[]},{cycle:1}]){const bad={...a,...change},p=w.project(input([c,bad],[bad.id]));assert.equal(p.balance,100);assert.deepEqual(p.owned,[]);assert.equal(p.canPurchase,false);}
});
test('safe integer limits fail closed and reserved/prototype identifiers never corrupt maps',()=>{
 const w=wallet();assert.throws(()=>w.project(input([credit('a',Number.MAX_SAFE_INTEGER),credit('b',1)])),code('WALLET_OVERFLOW'));
 const c=credit('__proto__',100),a=buy(w,[c],'constructor');const p=w.project(input([c,a],[a.id]));assert.equal(p.balance,20);assert.equal({}.polluted,undefined);assert.deepEqual(p.owned,['a']);
 const reserved=w.project(input([credit('refund:fake',999)]));assert.equal(reserved.balance,0);assert.equal(reserved.canPurchase,false);
});
test('zero-price purchases still wait for acknowledgement and use no invented credit',()=>{
 const w=wallet(),p=buy(w,[],'free-buy','free');assert.deepEqual(p.claims,[]);assert.deepEqual(w.project(input([p])).owned,[]);assert.deepEqual(w.project(input([p],[p.id])).owned,['free']);assert.equal(w.project(input([p],[p.id])).balance,0);
});
test('quotes snapshot the real existing Grove catalog and leave legacy web wallet behavior intact',()=>{
 wallet();const context=vm.createContext({});vm.runInContext(fs.readFileSync('rewards.js','utf8'),context);const actual=vm.runInContext('({rewards:GROVE_REWARD_CATALOG,projects:GROVE_PROJECT_CATALOG})',context),catalog=JSON.parse(JSON.stringify(actual));const w=createWallet({priceBooks:{1:catalog},currentPriceVersion:1});for(const row of catalog.rewards)assert.equal(w.quote(target(row.id)),row.cost);for(const project of catalog.projects)for(let i=0;i<project.stages.length;i++)assert.equal(w.quote({kind:'project',id:project.id,stage:i+1}),project.stages[i].cost);const expected=w.quote(target(catalog.rewards[0].id));catalog.rewards[0].cost=9999;assert.equal(w.quote(target(catalog.rewards[0].id)),expected);
 const s={stars:0,rewards:{ribbons:10}};context.refreshGroveWallet(s,1);assert.equal(context.redeemGroveReward(s,'violet-leaves',2),true);assert.equal(s.groveRewards.balance,7);
});
test('a maximum-length original receipt still yields a valid stable refund lot and rebuy',()=>{
 const w=wallet(),c=credit('credit',100),p=buy(w,[c],'p'.repeat(200)),r=w.prepareRefund(input([c,p],[p.id]),{id:'refund-long',purchaseId:p.id,online:true}),b=buy(w,[c,p,r],'rebuy-long','a',[p.id,r.id]);
 const result=w.project(input([c,p,r,b],[p.id,r.id,b.id]));assert.equal(result.status,'ready');assert.equal(result.balance,20);
});
test('a refund-funded rebuy cannot hide in the original purchase cycle',()=>{
 const w=wallet(),c=credit('credit',100),p=buy(w,[c],'original'),r=w.prepareRefund(input([c,p],[p.id]),{id:'undo',purchaseId:p.id,online:true}),b=buy(w,[c,p,r],'a-rebuy','a',[p.id,r.id]);const forged={...b,cycle:0};delete forged.afterRefund;
 const result=w.project(input([c,p,r,forged],[p.id,r.id,forged.id]));assert.equal(result.status,'needs-recovery');assert.ok(result.rejected.some(x=>x.id===forged.id));assert.equal(result.balance,100);
});
test('a recognized stage dependency cannot be smuggled onto an ordinary reward',()=>{
 const w=wallet(),c=credit('credit',100),p={...buy(w,[c],'wrong-stage'),previousStageId:c.id};const result=w.project(input([c,p],[p.id]));assert.equal(result.status,'needs-recovery');assert.equal(result.balance,100);
});
test('overlap caps each lot exactly even when the sum of valid claims exceeds the safe integer range',()=>{
 wallet();const max=Number.MAX_SAFE_INTEGER,w=createWallet({priceBooks:{1:{rewards:[{id:'a',cost:max},{id:'b',cost:max}],projects:[]}},currentPriceVersion:1}),c=credit('large',max),a=buy(w,[c],'a','a'),b=buy(w,[c],'b','b');const p=w.project(input([c,a,b,credit('fresh',1)],[a.id,b.id]));assert.equal(p.balance,1);assert.equal(p.lots.find(l=>l.id===c.id).spent,max);assert.equal(p.lots.find(l=>l.id==='fresh').available,1);
});
test('the same portable implementation runs as a classic browser script without CommonJS',()=>{
 wallet();const context=vm.createContext({});vm.runInContext(fs.readFileSync('core/sync-wallet.js','utf8'),context);const value=vm.runInContext(`(()=>{const scope={namespace:'synthetic',profileUuid:'child'},w=GroveSyncWallet.createWallet({priceBooks:{1:{rewards:[{id:'tree',cost:3}],projects:[]}},currentPriceVersion:1}),c={schema:1,kind:'credit',id:'earned',scope,amount:5},p=w.preparePurchase({scope,facts:[c],acknowledgedIds:[]},{id:'purchase',target:{kind:'reward',id:'tree'},online:true});return JSON.stringify(w.project({scope,facts:[p,c],acknowledgedIds:[p.id]}));})()`,context);const p=JSON.parse(value);assert.equal(p.balance,2);assert.deepEqual(p.owned,['tree']);
});
test('foreign same-ID facts cannot overwrite a current wallet credit or active receipt',()=>{
 const w=wallet(),c=credit('same',100),foreign={...c,amount:999,scope:{...scope,namespace:'other-account'}},p=buy(w,[c],'purchase'),other={...p,scope:{...scope,profileUuid:'sibling'}};const result=w.project(input([foreign,other,c,p],[p.id]));assert.equal(result.balance,20);assert.deepEqual(result.owned,['a']);assert.equal(result.status,'ready');assert.equal(result.retained.length,4);
});
test('prototype-shaped project IDs remain own data keys without changing any prototype',()=>{
 wallet();const w=createWallet({priceBooks:{1:{rewards:[],projects:[{id:'__proto__',stages:[{cost:1},{cost:2}]}]}},currentPriceVersion:1}),c=credit('credit',10),first={kind:'project',id:'__proto__',stage:1},second={...first,stage:2},a=buy(w,[c],'piece-one',first),b=buy(w,[c,a],'piece-two',second,[a.id]),p=w.project(input([c,a,b],[a.id,b.id]));assert.equal(p.projects.__proto__.stage,2);assert.equal(Object.getPrototypeOf(p.projects),Object.prototype);assert.equal({}.stage,undefined);assert.equal(p.balance,7);
});
test('legitimate two-device forks, Undo/rebuy and delayed merges converge without using later earnings for debt',()=>{
 const w=wallet();for(let seed=1;seed<=8;seed++){
  let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};const devices=[[credit('seed-credit',200)],[credit('seed-credit',200)]];let sequence=0;
  const merge=(a,b)=>[...new Map([...a,...b].map(row=>[row.id,row])).values()];const data=facts=>input(facts,facts.filter(f=>['purchase','refund'].includes(f.kind)).map(f=>f.id));
  for(let step=0;step<60;step++){
   const at=random()%2,rows=devices[at],view=w.project(data(rows));assert.equal(view.status,'ready');const request='request-'+seed+'-'+sequence++;
   if(step%5===0){devices[at]=merge(rows,devices[1-at]);continue;}
   if(step%3===0)rows.push(credit('earning-'+request,random()%40+1));
   else if(step%3===1){const desired=random()%3===0?piece((view.projects.project?.stage||0)+1):target(random()%2?'a':'b');try{rows.push(w.preparePurchase(data(rows),{id:request,target:desired,online:true}));}catch(e){assert.ok(['WALLET_OWNED','WALLET_INSUFFICIENT','WALLET_PRICE'].includes(e.code),e.code);}}
   else{const active=view.receipts.filter(r=>!r.refunded&&(r.target.kind==='reward'||view.projects[r.target.id]?.stage===r.target.stage));if(active.length)rows.push(w.prepareRefund(data(rows),{id:request,purchaseId:active[random()%active.length].id,online:true}));}
  }
  const merged=merge(...devices),ack=data(merged).acknowledgedIds,a=w.project(input(merged,ack)),b=w.project(input([...merged].reverse(),[...ack].reverse()));assert.deepEqual(a,b);assert.equal(a.status,'ready');assert.ok(Number.isSafeInteger(a.balance)&&a.balance>=0);
  const later=w.project(input([...merged,credit('final-fresh-'+seed,20)],ack));assert.equal(later.balance-a.balance,20);assert.deepEqual(later.owned,a.owned);assert.deepEqual(later.projects,a.projects);
 }
});
