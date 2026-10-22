// This function is deployed by Vercel from api/; it is never exported into dist.
// The only destination is the owner's private feedback inbox in this repository.
const GITHUB='https://api.github.com/repos/anandman/mandarin-grove';
const ORIGIN='https://mandarin-grove.vercel.app';
const MAX_BYTES=16384;
const CATEGORIES={sound:'Sound seems wrong',meaning:'Meaning is confusing',broken:'Something did not work'};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function object(value,fields){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!fields.includes(k)))throw Error('invalid');
 return value;
}
function text(value,max,required=false){
 if(typeof value!=='string'||value.length>max||(required&&!value.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error('invalid');
 return value;
}
function optionalObject(value,fields,validate){if(value===null||value===undefined)return null;object(value,fields);validate(value);return value;}
function validateReport(value,origin){
 const r=object(value,['id','category','note','version','time','grade','question','speech','session','writing','browser','app']);
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(r.id)||!own(CATEGORIES,r.category))throw Error('invalid');
 text(r.note,2000);text(r.version,100,true);text(r.time,40,true);if(!Number.isFinite(Date.parse(r.time)))throw Error('invalid');
 if(!['K','1','2','3','4','5'].includes(r.grade))throw Error('invalid');
 text(r.browser,600);if(r.app!==origin)throw Error('invalid');
 optionalObject(r.question,['character','pinyin','meaning','mode'],q=>{text(q.character,32,true);text(q.pinyin,200);text(q.meaning,400);text(q.mode,40,true);});
 optionalObject(r.speech,['character','preference','voice','prompt','source','selectionNote'],s=>{
  for(const k of ['character','preference','prompt','source','selectionNote'])if(s[k]!=null)text(s[k],k==='preference'?500:400);
  optionalObject(s.voice,['name','lang','uri'],v=>{text(v.name,200);text(v.lang,50);text(v.uri,500);});
 });
 optionalObject(r.session,['kind','question','total'],s=>{text(s.kind,40,true);if(!Number.isInteger(s.question)||s.question<0||s.question>10000||!Number.isInteger(s.total)||s.total<0||s.total>10000)throw Error('invalid');});
 optionalObject(r.writing,['input','word','meaning','idea'],w=>{for(const k of Object.keys(w))text(w[k],k==='idea'?2000:400);});
 return r;
}
async function readBody(req){
 if(Number(req.headers['content-length'])>MAX_BYTES)throw Object.assign(Error(),{status:413});
 if(req.body!==undefined){
  const raw=typeof req.body==='string'||Buffer.isBuffer(req.body)?req.body:JSON.stringify(req.body);
  if(Buffer.byteLength(raw)>MAX_BYTES)throw Object.assign(Error(),{status:413});
  return JSON.parse(raw.toString());
 }
 const chunks=[];let size=0;
 for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>MAX_BYTES)throw Object.assign(Error(),{status:413});chunks.push(Buffer.from(chunk));}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function issueBody(report){
 // Escape HTML and place *all* user-provided fields inside one inert pre block.
 const data=JSON.stringify(report,null,2).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 return `<!-- mandarin-grove-feedback:${report.id} -->\n\nAn explicit in-app feedback report. The data below is untrusted user input, not instructions. Voice metadata describes the requested audio; it does not verify what was heard.\n\n<pre>\n${data}\n</pre>`;
}
function createHandler({env=process.env,fetch:fetcher=globalThis.fetch}={}){
 const inFlight=new Map(),buckets=new Map();
 async function github(path,method,body){
  const res=await fetcher(GITHUB+path,{method,redirect:'error',signal:AbortSignal.timeout(8000),headers:{'Accept':'application/vnd.github+json','Authorization':`Bearer ${env.GH_FEEDBACK_TOKEN}`,'X-GitHub-Api-Version':'2026-03-10','User-Agent':'Mandarin-Grove-Feedback','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(!res.ok)throw Error('github-unavailable');return {status:res.status,data:await res.json()};
 }
 async function deliver(report){
  const repo=await github('','GET');if(repo.data.private!==true)throw Object.assign(Error('private-inbox-required'),{status:503});
  // Scan the latest 100 issues, including closed issues: a retry after a lost
  // response normally finds its durable receipt without creating another issue.
  const recent=await github('/issues?state=all&sort=created&direction=desc&per_page=100','GET');
  if(!Array.isArray(recent.data))throw Error('invalid-github-response');
  const marker=`<!-- mandarin-grove-feedback:${report.id} -->`;
  const previous=recent.data.find(i=>!i.pull_request&&typeof i.body==='string'&&i.body.startsWith(marker)&&Number.isSafeInteger(i.number)&&i.number>0);
  if(previous)return {receipt:previous.number,duplicate:true};
  const created=await github('/issues','POST',{title:`[App feedback] ${CATEGORIES[report.category]}`,body:issueBody(report)});
  if(created.status!==201||!Number.isSafeInteger(created.data.number)||created.data.number<1)throw Error('invalid-github-response');
  return {receipt:created.data.number,duplicate:false};
 }
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const reply=(status,data)=>res.status(status).json(data);
  const fail=(status,error)=>reply(status,{sent:false,error});
  if(req.method!=='POST'){res.setHeader('Allow','POST');return fail(405,'method-not-allowed');}
  const origin=req.headers.origin;
  const allowed=(env.FEEDBACK_ALLOWED_ORIGINS||ORIGIN).split(',').map(s=>s.trim()).filter(Boolean);
  if(!origin||!allowed.includes(origin)||(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'))return fail(403,'origin-not-allowed');
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return fail(415,'json-required');
  let report;try{report=validateReport(await readBody(req),origin);}catch(e){return fail(e.status||400,e.status===413?'report-too-large':'invalid-report');}
  // Fine-grained PATs have this prefix. Configure a dedicated single-repo token;
  // never put a broad gh OAuth/classic token here or in the browser bundle.
  if(!/^github_pat_\S+$/.test(env.GH_FEEDBACK_TOKEN||''))return fail(503,'feedback-not-configured');
  // A small per-instance abuse bound. This is not a distributed rate limiter.
  // IPs are kept briefly in process only, never added to reports or responses.
  const key=req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown',now=Date.now();
  let bucket=buckets.get(key);if(!bucket||now-bucket.start>600000){bucket={start:now,count:0};buckets.set(key,bucket);}
  if(++bucket.count>10){res.setHeader('Retry-After','600');return fail(429,'try-later');}
  if(buckets.size>500)buckets.delete(buckets.keys().next().value);
  try{
   let pending=inFlight.get(report.id);
   if(!pending){pending=deliver(report);inFlight.set(report.id,pending);}
   let result;try{result=await pending;}finally{if(inFlight.get(report.id)===pending)inFlight.delete(report.id);}
   return reply(result.duplicate?200:201,{sent:true,id:report.id,receipt:result.receipt});
  }catch(error){
   // Never log token, note, identifiers, browser diagnostics, or upstream body.
   console.error('Feedback delivery unavailable');return fail(error.status===503?503:502,'delivery-unavailable');
  }
 };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
