const test=require('node:test'),assert=require('node:assert/strict'),{Readable}=require('node:stream'),{randomUUID}=require('node:crypto');
let createNative;try{({createHandler:createNative}=require('../api/native-feedback.js'));}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
const app='design.highgain.mandaringrove',origins={ios:'capacitor://localhost',android:'https://localhost'},env={GH_FEEDBACK_TOKEN:'github_pat_synthetic_native_only'};
const report=(platform='ios')=>({id:'49bb5d96-6826-422c-8b2a-c15a63bebdd3',category:'sound',note:'Synthetic note',version:'native-test',time:'2026-11-02T12:00:00.000Z',app,platform,question:{character:'子',pinyin:'zǐ',meaning:'child',mode:'listen'},audio:{source:'msu',recording:'audio/msu-zi3-mv3-0123456789ab.mp3'}});
const response=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
function github(){const calls=[];return {calls,fetch:async(url,opts)=>{calls.push({url,...opts});if(url.endsWith('/mandarin-grove-feedback'))return response(200,{private:true});if(opts.method==='GET')return response(200,[]);return response(201,{number:48});}};}
function handler(options){assert.equal(typeof createNative,'function','A separate native receiver preserves the existing web origin policy');return createNative(options);}
async function request(h,body=report(),headers={},method='POST'){
 const req=Readable.from([typeof body==='string'?body:JSON.stringify(body)]);req.method=method;req.headers={origin:origins.ios,'content-type':'application/json','x-real-ip':'192.0.2.77',...headers};const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;},end(){this.ended=true;return this;}};await h(req,res);return res;
}
test('only the two exact supported native origins receive credential-free POST preflight',async()=>{
 const gh=github(),h=handler({env,fetch:gh.fetch});
 for(const origin of Object.values(origins)){
  const r=await request(h,'',{origin,'access-control-request-method':'POST','access-control-request-headers':'Content-Type'},'OPTIONS');assert.equal(r.statusCode,204);assert.equal(r.headers['Access-Control-Allow-Origin'],origin);assert.equal(r.headers['Access-Control-Allow-Methods'],'POST');assert.equal(r.headers['Access-Control-Allow-Headers'],'Content-Type');assert.equal(r.headers['Access-Control-Allow-Credentials'],undefined);assert.match(r.headers.Vary,/Origin/);
 }
 assert.equal(gh.calls.length,0);
});
test('opaque, foreign, missing and expanded-config origins cannot send or preflight',async()=>{
 const gh=github(),h=handler({env:{...env,FEEDBACK_ALLOWED_ORIGINS:'https://evil.example'},fetch:gh.fetch});
 for(const origin of [undefined,'null','file://','http://localhost','https://localhost.evil.example','https://mandarin-grove.vercel.app','https://evil.example'])for(const method of ['POST','OPTIONS']){
  const r=await request(h,report(),{origin,'access-control-request-method':'POST','access-control-request-headers':'content-type'},method);assert.equal(r.statusCode,403);assert.equal(r.headers['Access-Control-Allow-Origin'],undefined);
 }
 assert.equal(gh.calls.length,0);
});
test('preflight refuses extra headers and unsupported methods; GET cannot deliver',async()=>{
 const gh=github(),h=handler({env,fetch:gh.fetch});
 for(const headers of [{'access-control-request-method':'PUT','access-control-request-headers':'content-type'},{'access-control-request-method':'POST','access-control-request-headers':'content-type,authorization'}])assert.equal((await request(h,'',headers,'OPTIONS')).statusCode,403);
 const r=await request(h,'',{},'GET');assert.equal(r.statusCode,405);assert.equal(r.headers.Allow,'POST, OPTIONS');assert.equal(gh.calls.length,0);
});
test('bounded native reports create only a fixed private inbox receipt on both platforms',async()=>{
 for(const platform of ['ios','android']){
  const gh=github(),body=report(platform),r=await request(handler({env,fetch:gh.fetch}),body,{origin:origins[platform],'sec-fetch-site':'cross-site'});assert.equal(r.statusCode,201);assert.deepEqual(r.data,{sent:true,id:body.id,receipt:48});assert.equal(r.headers['Access-Control-Allow-Origin'],origins[platform]);assert.equal(r.headers['Cache-Control'],'no-store');assert.equal(r.headers['X-Content-Type-Options'],'nosniff');assert.equal(gh.calls.length,3);assert.ok(gh.calls.every(c=>c.url.startsWith('https://api.github.com/repos/anandman/mandarin-grove-feedback')));const created=JSON.parse(gh.calls.at(-1).body);assert.match(created.body,/"platform":/);assert.ok(!created.body.includes(env.GH_FEEDBACK_TOKEN));assert.equal(created.assignees,undefined);assert.equal(created.labels,undefined);
 }
});
test('unknown learner, device and private context fields are rejected before upstream access',async()=>{
 const gh=github(),h=handler({env,fetch:gh.fetch});
 for(const [key,value]of Object.entries({name:'private',childId:'private',deviceId:'private',account:'private',progress:{stars:8},grade:'2',session:{question:1},writing:{input:'private draft'},browser:'private UA',voiceURI:'personal'}))assert.equal((await request(h,{...report(),[key]:value})).statusCode,400);
 for(const patch of [{question:{...report().question,answer:'private'}},{audio:{source:'device',voiceURI:'private'}},{audio:{source:'msu',recording:'https://evil.example/private.mp3'}}])assert.equal((await request(h,{...report(),...patch})).statusCode,400);
 assert.equal(gh.calls.length,0);
});
test('origin/platform/app mismatches, invalid JSON, dates, IDs and unknown categories fail closed',async()=>{
 const gh=github(),h=handler({env,fetch:gh.fetch});
 for(const patch of [{platform:'android'},{platform:'web'},{app:'other-app'},{id:'not-a-uuid'},{category:'other'},{time:'invalid'},{note:'x'.repeat(2001)},{question:{character:'子',pinyin:'zǐ',meaning:'child',mode:''}}])assert.equal((await request(h,{...report(),...patch})).statusCode,400);
 assert.equal((await request(h,'{invalid')).statusCode,400);assert.equal((await request(h,report(),{'content-type':'text/plain'})).statusCode,415);assert.equal((await request(h,'x'.repeat(16385))).statusCode,413);assert.equal((await request(h,report(),{'content-length':'16385'})).statusCode,413);assert.equal(gh.calls.length,0);
});
test('static content provenance is bounded and a context-free parent message is valid',async()=>{
 const gh=github(),h=handler({env,fetch:gh.fetch});const content={packId:'public-pack',itemId:'public-item',version:'1',sourceId:'public-source',reviewStatus:'reviewed'};
 assert.equal((await request(h,{...report(),content})).statusCode,201);
 for(const bad of [{...content,learner:'private'},{...content,itemId:'x'.repeat(161)},{...content,sourceId:'bad\u202ehidden'}])assert.equal((await request(h,{...report(),content:bad})).statusCode,400);
 const plain=report();delete plain.question;delete plain.audio;plain.id=randomUUID();assert.equal((await request(h,plain)).statusCode,201);
});
test('a public destination or missing scoped token cannot receive a native report',async()=>{
 for(const token of [undefined,'gho_synthetic','ghp_synthetic']){const gh=github(),r=await request(handler({env:{GH_FEEDBACK_TOKEN:token},fetch:gh.fetch}));assert.equal(r.statusCode,503);assert.equal(gh.calls.length,0);}
 const calls=[],r=await request(handler({env,fetch:async(url,opts)=>{calls.push(opts.method);return response(200,{private:false});}}));assert.equal(r.statusCode,503);assert.deepEqual(calls,['GET']);
});
test('an existing durable receipt survives a fresh handler and never creates another issue',async()=>{
 let posts=0;const body=report(),existing={number:77,body:'<!-- mandarin-grove-feedback:'+body.id+' -->\nprivate report'};
 const fetch=async(url,opts)=>url.endsWith('/mandarin-grove-feedback')?response(200,{private:true}):opts.method==='GET'?response(200,[existing]):(posts++,response(201,{number:78}));
 for(let i=0;i<2;i++){const r=await request(handler({env,fetch}),body);assert.equal(r.statusCode,200);assert.deepEqual(r.data,{sent:true,id:body.id,receipt:77});}assert.equal(posts,0);
});
test('concurrent same-ID retries share one delivery within the native worker',async()=>{
 let release,posts=0;const gate=new Promise(r=>release=r),fetch=async(url,opts)=>{if(url.endsWith('/mandarin-grove-feedback')){await gate;return response(200,{private:true});}if(opts.method==='GET')return response(200,[]);posts++;return response(201,{number:48});};const h=handler({env,fetch}),a=request(h),b=request(h);await new Promise(r=>setImmediate(r));release();const [ra,rb]=await Promise.all([a,b]);assert.equal(ra.data.sent,true);assert.equal(rb.data.sent,true);assert.equal(posts,1);
});
test('native abuse bounds are explicit and never persist or return IP addresses',async()=>{
 const gh=github(),h=handler({env,fetch:gh.fetch});for(let i=0;i<10;i++)assert.equal((await request(h,{...report(),id:randomUUID()})).statusCode,201);const r=await request(h,{...report(),id:randomUUID()});assert.equal(r.statusCode,429);assert.equal(r.headers['Retry-After'],'600');assert.ok(!JSON.stringify(gh.calls).includes('192.0.2.77'));assert.ok(!JSON.stringify(r).includes('192.0.2.77'));
});
test('report HTML is inert and delivery failures never log upstream/private content',async()=>{
 const gh=github(),body={...report(),note:'<script>private & note</script>'};await request(handler({env,fetch:gh.fetch}),body);const created=JSON.parse(gh.calls.at(-1).body);assert.match(created.body,/&lt;script&gt;private &amp; note&lt;\/script&gt;/);assert.ok(!created.body.includes('<script>'));
 const logs=[],previous=console.error;console.error=(...a)=>logs.push(a.join(' '));try{const r=await request(handler({env,fetch:async()=>response(500,{private:'secret upstream data'})}),body);assert.equal(r.statusCode,502);assert.equal(r.data.sent,false);}finally{console.error=previous;}assert.deepEqual(logs,['Feedback delivery unavailable']);
});
test('the original web endpoint still rejects every native origin',async()=>{
 const {createHandler}=require('../api/feedback.js'),gh=github(),h=createHandler({env,fetch:gh.fetch});for(const origin of Object.values(origins))assert.equal((await request(h,report(),{origin})).statusCode,403);assert.equal(gh.calls.length,0);
});
test('real loopback HTTP exercises native CORS, streamed JSON and receipts with mocked delivery only',async()=>{
 const http=require('node:http'),gh=github(),h=handler({env,fetch:gh.fetch});const server=http.createServer((req,res)=>{res.status=n=>{res.statusCode=n;return res;};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return res;};void h(req,res).catch(()=>{res.statusCode=500;res.end();});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+'/api/native-feedback';
 try{
  const preflight=await fetch(url,{method:'OPTIONS',headers:{Origin:origins.ios,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});assert.equal(preflight.status,204);assert.equal(await preflight.text(),'');assert.equal(preflight.headers.get('access-control-allow-origin'),origins.ios);assert.equal(gh.calls.length,0);
  const sent=await fetch(url,{method:'POST',headers:{Origin:origins.ios,'Content-Type':'application/json'},body:JSON.stringify(report())});assert.equal(sent.status,201);assert.deepEqual(await sent.json(),{sent:true,id:report().id,receipt:48});const calls=gh.calls.length;
  const blocked=await fetch(url,{method:'OPTIONS',headers:{Origin:'http://127.0.0.1:4263','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});assert.equal(blocked.status,403);assert.equal(blocked.headers.get('access-control-allow-origin'),null);
  const privateContext=await fetch(url,{method:'POST',headers:{Origin:origins.ios,'Content-Type':'application/json'},body:JSON.stringify({...report(),writing:{input:'not uploaded'}})});assert.equal(privateContext.status,400);assert.equal(gh.calls.length,calls);
  const oversized=await new Promise((resolve,reject)=>{const r=http.request(url,{method:'POST',headers:{Origin:origins.ios,'Content-Type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});r.on('error',reject);r.write('x'.repeat(8300));r.end('x'.repeat(8300));});assert.equal(oversized,413);assert.equal(gh.calls.length,calls);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
for(const field of ['id','category'])test('native '+field+' must be a string; coercible arrays cannot create receipts or evade coalescing',async()=>{
 const gh=github(),body=report();body[field]=[body[field]];const r=await request(handler({env,fetch:gh.fetch}),body);assert.equal(r.statusCode,400);assert.equal(gh.calls.length,0);
});

test('preserved prototype builds can still submit bounded reports on both native platforms',async()=>{
 for(const platform of ['ios','android']){
  const gh=github(),body={...report(platform),app:'io.github.anandman.mandaringrove'};
  const r=await request(handler({env,fetch:gh.fetch}),body,{origin:origins[platform]});
  assert.equal(r.statusCode,201);assert.equal(r.data.sent,true);
 }
});
test('lookalike app identities cannot deliver a native report',async()=>{
 for(const app of ['design.highgain.mandaringrove.other','design.highgain.mandarin-grove','io.github.anandman.mandaringrove.other','DESIGN.HIGHGAIN.MANDARINGROVE']){
  const gh=github(),r=await request(handler({env,fetch:gh.fetch}),{...report(),app});
  assert.equal(r.statusCode,400);assert.equal(gh.calls.length,0);
 }
});
