const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});try{
 const owners=await browser.newContext(),ownerPage=await owners.newPage();await ownerPage.goto(process.env.APP_URL||'http://127.0.0.1:4174');
 const ownerCheck=await ownerPage.evaluate(()=>{
  PR={cur:'owner-a',list:[{id:'owner-a',name:'A',gr:'2',av:'🐼'},{id:'owner-b',name:'B',gr:'2',av:'🐳'}]};savePR();loadS();S.ownerMarker='only A';save();const before=localStorage.getItem('zh_p_owner-b'),real=Storage.prototype.setItem;
  PR.cur='owner-b';savePR();Storage.prototype.setItem=function(k,v){if(k==='zh_p_owner-b')throw Error('Synthetic load save failure');return real.call(this,k,v);};try{loadS();}catch{}Storage.prototype.setItem=real;
  let blocked=false;try{save();}catch{blocked=true;}return {blocked,before,after:localStorage.getItem('zh_p_owner-b')};
 });assert.equal(ownerCheck.blocked,true,'Failed child load must block subsequent writes under a different owner');assert.equal(ownerCheck.after,ownerCheck.before);await owners.close();
 for(const id of ['__proto__','constructor','toString']){const context=await browser.newContext(),page=await context.newPage();await page.addInitScript(id=>{localStorage.setItem('zh_profiles',JSON.stringify({cur:id,list:[{id,name:'Synthetic safe identifier',gr:'2',av:'🐼'}]}));localStorage.setItem('zh_p_'+id,JSON.stringify({stars:7,streak:0,last:'',pts:{},box:{},due:{},cfg:{}}));},id);await page.goto(process.env.APP_URL||'http://127.0.0.1:4174');assert.equal(await page.getByRole('button',{name:'Practice',exact:true}).count(),1,'A valid opaque child ID must open normally: '+id);assert.equal(await page.evaluate(()=>S.stars),7);await context.close();}
 console.log('PASS: a failed child load cannot redirect another child’s in-memory progress into its snapshot.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
