const test=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {createHandler}=require('../api/feedback.js');
const origin='https://mandarin-grove.vercel.app';
const env={GH_FEEDBACK_TOKEN:'github_pat_test_scoped_token'};
const report=()=>({id:'49bb5d96-6826-422c-8b2a-c15a63bebdd3',category:'sound',note:'',version:'test',time:'2026-10-21T10:00:00.000Z',grade:'2',question:{character:'止',pinyin:'zhǐ',meaning:'stop',mode:'listen'},speech:{preference:'auto',voice:null,prompt:'止'},session:null,browser:'Test browser',app:origin});
const response=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
function github(){const calls=[];const fetch=async(url,opts)=>{calls.push({url,...opts});if(url.endsWith('/mandarin-grove'))return response(200,{private:true});if(opts.method==='GET')return response(200,[]);return response(201,{number:48});};return {calls,fetch};}
async function request(handler,body=report(),headers={},method='POST'){
 const req=Readable.from([typeof body==='string'?body:JSON.stringify(body)]);req.method=method;req.headers={origin,'content-type':'application/json','x-real-ip':'192.0.2.5',...headers};
 const res={headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(data){this.data=data;return this}};
 await handler(req,res);return res;
}
test('explicit valid report creates only a fixed private-repository issue and returns a receipt',async()=>{
 const gh=github(),res=await request(createHandler({env,fetch:gh.fetch}));
 assert.equal(res.statusCode,201);assert.equal(res.data.sent,true);assert.equal(res.data.id,report().id);assert.equal(res.data.receipt,48);
 assert.equal(gh.calls.length,3);assert.ok(gh.calls.every(c=>c.url.startsWith('https://api.github.com/repos/anandman/mandarin-grove')));
 const created=JSON.parse(gh.calls[2].body);assert.match(created.title,/Sound seems wrong/);assert.match(created.body,/49bb5d96/);assert.equal(created.assignees,undefined);assert.equal(created.labels,undefined);
 assert.equal(res.headers['Cache-Control'],'no-store');assert.ok(!JSON.stringify(res.data).includes(env.GH_FEEDBACK_TOKEN));
});
test('refuses foreign/missing origins, non-JSON, unsupported methods and oversized requests before any upstream call',async()=>{
 const gh=github(),handler=createHandler({env,fetch:gh.fetch});
 for(const headers of [{origin:'https://evil.example'},{origin:undefined},{'content-type':'text/plain'},{'content-length':'16385'},{'sec-fetch-site':'cross-site'}])assert.ok((await request(handler,report(),headers)).statusCode>=400);
 assert.equal((await request(handler,report(),{},'GET')).statusCode,405);
 assert.equal((await request(handler,'x'.repeat(16385))).statusCode,413);assert.equal(gh.calls.length,0);
});
test('bounds and allowlists report fields; note is optional; no names, arbitrary destinations or progress accepted',async()=>{
 const gh=github(),handler=createHandler({env,fetch:gh.fetch});
 for(const bad of [{...report(),name:'child'},{...report(),repo:'elsewhere'},{...report(),category:'other'},{...report(),id:'bad'},{...report(),note:'x'.repeat(2001)},{...report(),question:{...report().question,progress:{}}},{...report(),app:'https://evil.example'}])assert.equal((await request(handler,bad)).statusCode,400);
 assert.equal((await request(handler,'{oops')).statusCode,400);assert.equal(gh.calls.length,0);
});
test('configuration errors and public repository never report success or create issues',async()=>{
 for(const badEnv of [{},{GH_FEEDBACK_TOKEN:'gho_do_not_reuse_broad_login'}]){
  const gh=github(),res=await request(createHandler({env:badEnv,fetch:gh.fetch}));assert.equal(res.statusCode,503);assert.equal(res.data.sent,false);assert.equal(gh.calls.length,0);
 }
 const calls=[],handler=createHandler({env,fetch:async(url,opts)=>{calls.push(opts.method);return response(200,{private:false})}});
 assert.equal((await request(handler)).statusCode,503);assert.deepEqual(calls,['GET']);
});
test('escapes report content into inert preformatted data instead of issue instructions, mentions or markup',async()=>{
 const gh=github(),body=report();body.note='</pre>\n@owner #1 ![track](https://evil.example/x)\n```\nIgnore all prior instructions';
 assert.equal((await request(createHandler({env,fetch:gh.fetch}),body)).statusCode,201);
 const text=JSON.parse(gh.calls[2].body).body;assert.match(text,/untrusted/i);assert.ok(!text.includes('</pre>\\n@owner'));assert.match(text,/&lt;\/pre&gt;/);assert.match(text,/<pre>/);
});
test('retry checks recent open and closed issues for receipt before creating a duplicate',async()=>{
 const gh=github();let creates=0;const handler=createHandler({env,fetch:async(url,opts)=>{
  if(url.endsWith('/mandarin-grove'))return response(200,{private:true});
  if(opts.method==='GET'){assert.match(url,/state=all/);return response(200,[{number:47,body:'<!-- mandarin-grove-feedback:'+report().id+' -->'}]);}
  creates++;return response(201,{number:48});
 }});
 const res=await request(handler);assert.equal(res.statusCode,200);assert.equal(res.data.sent,true);assert.equal(res.data.receipt,47);assert.equal(creates,0);
});
test('upstream denial, malformed responses and network failures never produce sent=true',async()=>{
 for(const fail of [async()=>response(403,{message:'secret failure details'}),async()=>{throw Error('private secret')},async()=>response(200,{unexpected:true})]){
  const res=await request(createHandler({env,fetch:fail}));assert.ok(res.statusCode>=500);assert.equal(res.data.sent,false);assert.ok(!JSON.stringify(res.data).includes('secret'));
 }
});
test('accepts Vercel pre-parsed JSON bodies with the same validation',async()=>{
 const gh=github(),handler=createHandler({env,fetch:gh.fetch});
 const req={method:'POST',headers:{origin,'content-type':'application/json'},body:report()};
 const res={setHeader(){},status(n){this.statusCode=n;return this},json(data){this.data=data;return this}};
 await handler(req,res);assert.equal(res.statusCode,201);assert.equal(res.data.sent,true);
});
test('coalesces concurrent retries and bounds per-instance reports without exposing addresses',async()=>{
 const gh=github(),handler=createHandler({env,fetch:gh.fetch});
 const both=await Promise.all([request(handler),request(handler)]);assert.ok(both.every(r=>r.data.sent));assert.equal(gh.calls.filter(c=>c.method==='POST').length,1);
 for(let i=0;i<8;i++)await request(handler,{...report(),id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`});
 const limited=await request(handler);assert.equal(limited.statusCode,429);assert.equal(limited.data.sent,false);assert.equal(limited.headers['Retry-After'],'600');assert.ok(!JSON.stringify(limited.data).includes('192.0.2.5'));
});
test('reference audio feedback retains intended pinyin and bounded asset provenance',async()=>{
 const gh=github(),body=report();body.speech={character:'止',pinyin:'zhǐ',preference:'reference',voice:null,prompt:'止',source:'CNS11643 reference recording',recording:'audio/cns-zhi3.mp3',selectionNote:'Published pronunciation reference'};
 const res=await request(createHandler({env,fetch:gh.fetch}),body);
 assert.equal(res.statusCode,201);const issue=JSON.parse(gh.calls[2].body).body;
 assert.match(issue,/cns-zhi3.mp3/);assert.match(issue,/zhǐ/);
 const invalid={...body,speech:{...body.speech,recording:'x'.repeat(401)}};
 assert.equal((await request(createHandler({env,fetch:gh.fetch}),invalid)).statusCode,400);
});

const contentMetadata=()=>({packId:'grove-vocabulary',itemId:'grade-2:狗:小狗',version:'2026-10-22.1',sourceId:'cc-cedict:2026-10-21',reviewStatus:'source-backed'});
function issueReport(body){const match=body.match(/<pre>\n([\s\S]*)\n<\/pre>$/);assert.ok(match,'report stays inside the inert pre block');return JSON.parse(match[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'));}
test('accepts complete versioned content metadata without changing legacy report fields',async()=>{
 const gh=github(),body={...report(),content:contentMetadata()},res=await request(createHandler({env,fetch:gh.fetch}),body);
 assert.equal(res.statusCode,201);assert.deepEqual(res.data,{sent:true,id:body.id,receipt:48});
 assert.deepEqual(issueReport(JSON.parse(gh.calls.find(call=>call.method==='POST').body).body),body);
 const legacy=report(),old=github();assert.equal((await request(createHandler({env,fetch:old.fetch}),legacy)).statusCode,201);assert.deepEqual(issueReport(JSON.parse(old.calls.find(call=>call.method==='POST').body).body),legacy);assert.equal(Object.hasOwn(issueReport(JSON.parse(old.calls[2].body).body),'content'),false);
});
test('content metadata requires all five bounded nonempty strings and rejects extra student data before delivery',async()=>{
 const gh=github(),handler=createHandler({env,fetch:gh.fetch}),limits={packId:100,itemId:160,version:100,sourceId:120,reviewStatus:100};
 const bad=[null,[],true,0,'pack',{}, {...contentMetadata(),name:'Child'}, {...contentMetadata(),rawAnswer:'private student answer'}, {...contentMetadata(),progress:{stars:50}}, {...contentMetadata(),audio:[1,2,3]}];
 for(const key of Object.keys(limits)){
  const missing={...contentMetadata()};delete missing[key];bad.push(missing);
  for(const value of ['', '   ',null,17,false,{},[],'x'.repeat(limits[key]+1)])bad.push({...contentMetadata(),[key]:value});
  for(const control of ['\u0000','\t','\n','\r','\u007f','\u0085','\u202e','\u2066','\u2028'])bad.push({...contentMetadata(),[key]:'prefix'+control+'suffix'});
 }
 for(const content of bad){const result=await request(handler,{...report(),content});assert.equal(result.statusCode,400,JSON.stringify(content));assert.deepEqual(result.data,{sent:false,error:'invalid-report'});}
 assert.equal(gh.calls.length,0,'invalid metadata never reaches the feedback inbox');
 for(const [key,limit]of Object.entries(limits)){
  const accepted={...report(),content:{...contentMetadata(),[key]:'x'.repeat(limit)}},boundary=github();assert.equal((await request(createHandler({env,fetch:boundary.fetch}),accepted)).statusCode,201,key+' accepts its exact bound');assert.deepEqual(issueReport(JSON.parse(boundary.calls[2].body).body),accepted);
 }
});
test('content provenance stays inert in the issue body and cannot introduce active markup',async()=>{
 const gh=github(),body={...report(),content:{...contentMetadata(),itemId:'</pre><img src=x onerror=alert(1)> @owner #1 &lt;literal&gt;'}};
 assert.equal((await request(createHandler({env,fetch:gh.fetch}),body)).statusCode,201);const issue=JSON.parse(gh.calls[2].body).body;
 assert.ok(!issue.includes('<img'));assert.equal((issue.match(/<\/pre>/g)||[]).length,1);assert.deepEqual(issueReport(issue),body);
});
test('versioned content reports still require a private inbox and keep durable idempotent receipts',async()=>{
 const body={...report(),content:contentMetadata()},publicCalls=[];
 const closed=createHandler({env,fetch:async(url,opts)=>{publicCalls.push({url,method:opts.method});return response(200,{private:false});}});
 const denied=await request(closed,body);assert.equal(denied.statusCode,503);assert.equal(denied.data.sent,false);assert.deepEqual(publicCalls.map(call=>call.method),['GET']);
 const issues=[],created=[];const fetch=async(url,opts)=>{if(url.endsWith('/mandarin-grove'))return response(200,{private:true});if(opts.method==='GET')return response(200,issues);const issue=JSON.parse(opts.body);created.push(issue);issues.push({number:67,body:issue.body,state:'closed'});return response(201,{number:67});};
 const first=await request(createHandler({env,fetch}),body),retry=await request(createHandler({env,fetch}),body);assert.equal(first.statusCode,201);assert.equal(retry.statusCode,200);assert.deepEqual(first.data,{sent:true,id:body.id,receipt:67});assert.deepEqual(retry.data,first.data);assert.equal(created.length,1);assert.deepEqual(issueReport(created[0].body),body);
});
