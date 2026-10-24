/* Mandarin Grove web orchestration. Domain data and persistence are injected modules. */
const $=id=>document.getElementById(id),A=$('app');
const ALL=GroveCurriculum.cards,U=GroveCurriculum.units,GL=GroveCurriculum.grades,ORIG=GroveCurriculum.defaultCharacters;
const CARDS=[],GN={K:'Kindergarten',1:'1st grade',2:'2nd grade',3:'3rd grade',4:'4th grade',5:'5th grade'};
const MASTER=5,DAY=86400000,SLEEP=7,K='owenzh_v1',PK='zh_profiles';
// The ordered legacy collection is a saved-progress compatibility contract.
const ANIMALS=['🐶','🐱','🐮','🐯','🐰','🐼','🐨','🦁','🐸','🐵','🐧','🐥','🦊','🐻','🐷','🐭','🐹','🦄','🐴','🦒','🐘','🦓','🐢','🐙','🦋','🐳','🐬','🦉','🦖','🐲'];
const ANIMAL_NAMES=['Dog','Cat','Cow','Tiger','Rabbit','Panda','Koala','Lion','Frog','Monkey','Penguin','Chick','Fox','Bear','Pig','Mouse','Hamster','Unicorn','Horse','Giraffe','Elephant','Zebra','Turtle','Octopus','Butterfly','Whale','Dolphin','Owl','Dinosaur','Dragon'];
const BADGES=[['m5','🥉','5 characters','Earned five reward stars for each of 5 characters'],['m15','🥈','15 characters','Earned five reward stars for each of 15 characters'],['m30','🥇','30 characters','Earned five reward stars for each of 30 characters'],['s7','🔥','7-day streak','Practiced 7 days in a row'],['pq','📝','Perfect quiz','Every pinyin right on the weekly quiz']];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const blank=()=>GroveState.emptyProfile();
let PR={cur:null,list:[]},S=blank(),GROVE_SAVED_REGISTRY={cur:null,list:[]},GROVE_STATE_OWNER=null,GROVE_PROGRESS_READY=false,GROVE_SAVED_STATE=null;
let NAV=0,SESS=null,HS=[],HO=Object.create(null),catG='',catQ='',DI=-1,DL=[],dw=null,detailRequest=0,detailReturnFocus=null;
const STROKES={},strokeRequests=new Map();
let viewNavigation=null;
function focusMain(){const target=A.querySelector('h1')||A;target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'start'});}
// Wait for the replacement DOM, respecting explicit form/modal/filter focus.
new MutationObserver(()=>{
 const heading=A.querySelector('h1');if(!heading)return;
 document.title=(document.body.dataset.screen==='home'?'Home':heading.textContent.trim())+' · Mandarin Grove';
 const pending=viewNavigation,token=NAV;
 requestAnimationFrame(()=>{
  if(NAV!==token||!heading.isConnected||document.querySelector('dialog[open],.modal-overlay'))return;
  const active=document.activeElement;
  if(active===document.body||active===document.documentElement||active===A||(pending&&pending.origin===active&&!A.contains(active))){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  if(viewNavigation===pending)viewNavigation=null;
 });
}).observe(A,{childList:true});
$('skip-main').onclick=event=>{event.preventDefault();focusMain();};
function prof(){return PR.list.find(profile=>profile.id===PR.cur);}
function GR(){return prof()?.gr||'2';}
function KG(){return GR()==='K';}
function QU(grade=GR()){return U[grade]||[];}
function gList(grade=GR()){return [...(GL[grade]||'')];}
function BN(){return ['3','4','5'].includes(GR())?5:10;}
function GLB(){return GR()==='K'?'Kindergarten':'Grade '+GR();}
function ORD(grade){return grade==='K'?'K':grade+({1:'st',2:'nd',3:'rd'}[grade]||'th');}
function CHK(grade=GR()){
 const groups=QU(grade).map(([n,chars])=>({k:'Unit',n,c:[...chars]})),covered=new Set(groups.flatMap(group=>group.c));
 const extra=gList(grade).filter(char=>!covered.has(char)),size=['3','4','5'].includes(grade)?5:10;
 for(let i=0;i<extra.length;i+=size)groups.push({k:'Set',n:i/size+1,c:extra.slice(i,i+size)});
 return groups;
}
function gDef(){return GR()==='2'?[...ORIG]:[...(CHK()[0]?.c||[])];}
function SET(){return S.cfg.set?.length?[...S.cfg.set]:gDef();}
function setCards(){
 const selected=new Set(SET());CARDS.splice(0,CARDS.length,...ALL.filter(card=>selected.has(card.c)));document.body.classList.toggle('kg',KG());
}
function NCH(){const selected=new Set(SET());return CHK().find(group=>group.c.some(char=>!selected.has(char)));}
function batch(){
 const selected=SET(),last=selected.at(-1),group=CHK().find(group=>group.c.includes(last));
 const chars=group?group.c.filter(char=>selected.includes(char)):selected.slice(-BN());return chars.map(char=>ALL.find(card=>card.c===char)).filter(Boolean);
}
function loadS({persist=true}={}){
 const previous=S;GROVE_PROGRESS_READY=false;
 try{
  const candidate=PR.cur?GROVE_REPOSITORY.readProfile(PR.cur):blank();
  S=candidate;setCards();
  if(persist&&PR.cur)S=GROVE_REPOSITORY.saveProfile(PR.cur,S);
  GROVE_STATE_OWNER=PR.cur;GROVE_SAVED_STATE=JSON.parse(JSON.stringify(S));GROVE_PROGRESS_READY=true;
 }catch(error){S=previous;showStorageFailure(error);throw error;}
}
function savePR(){
 try{PR=GROVE_REPOSITORY.saveRegistry(PR);GROVE_SAVED_REGISTRY=JSON.parse(JSON.stringify(PR));}
 catch(error){PR=JSON.parse(JSON.stringify(GROVE_SAVED_REGISTRY));showStorageFailure(error);throw error;}
}
function save(cramSelectionChanged=false){
 if(!GROVE_PROGRESS_READY||GROVE_STATE_OWNER!==PR.cur){const error=Error('This child’s progress has not loaded. Reload before saving.');showStorageFailure(error);throw error;}
 const candidate=JSON.parse(JSON.stringify(S)),earned=refreshRewardState(candidate,GR());
 if(!cramSelectionChanged)candidate.cfg.cramUnits=storedCramSelections();
 try{S=PR.cur?GROVE_REPOSITORY.saveProfile(PR.cur,candidate):candidate;}
 catch(error){if(GROVE_SAVED_STATE){S=JSON.parse(JSON.stringify(GROVE_SAVED_STATE));setCards();}error.groveSaveRejected=true;showStorageFailure(error);throw error;}
 GROVE_SAVED_STATE=JSON.parse(JSON.stringify(S));
 // Rendering failures cannot undo an already committed durable save.
 hdr();announceRewards(earned);clearStorageFailure();
}
function saveProfileSettings(registry,candidate){
 if(!GROVE_PROGRESS_READY||GROVE_STATE_OWNER!==PR.cur)throw Error('Reload this child before saving settings.');
 const profile=registry.list.find(p=>p.id===PR.cur),earned=refreshRewardState(candidate,profile.gr);
 candidate.cfg.cramUnits=storedCramSelections();let saved;
 try{saved=GROVE_REPOSITORY.saveChildSettings(PR.cur,registry,candidate);}catch(error){showStorageFailure(error);throw error;}
 PR=saved.registry;S=saved.profile;GROVE_SAVED_REGISTRY=JSON.parse(JSON.stringify(PR));GROVE_SAVED_STATE=JSON.parse(JSON.stringify(S));
 clearStorageFailure();hdr();announceRewards(earned);
}
function today(date=new Date()){return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;}
function touchStreak(){
 const current=today();if(S.last===current)return;
 const previous=new Date();previous.setDate(previous.getDate()-1);S.streak=S.last===today(previous)?S.streak+1:1;S.last=current;
}
function isM(card){return (S.pts[card.c]||0)>=MASTER;}
function asleep(card){return isM(card)&&!!S.ok?.[card.c]&&Date.now()-S.ok[card.c]>SLEEP*DAY;}
function mastered(){return CARDS.filter(isM).length;}
function pop(text){const notice=document.createElement('div');notice.className='pop';notice.setAttribute('role','status');notice.textContent=text;document.body.append(notice);setTimeout(()=>notice.remove(),1200);}
function award(id){
 if(S.bad?.[id])return;S.bad??={};S.bad[id]=Date.now();save();
 const badge=BADGES.find(row=>row[0]===id);if(badge)after(900,()=>badgeShow(badge));
}
function checkBadges(){for(const [id,threshold]of [['m5',5],['m15',15],['m30',30]])if(mastered()>=threshold)award(id);if(S.streak>=7)award('s7');}
function badgeShow(badge){
 const previous=document.activeElement,notice=document.createElement('dialog');notice.className='bdg';notice.setAttribute('aria-label','New badge');
 const symbol=document.createElement('div');symbol.className='badge-symbol';symbol.textContent=badge[1];
 const title=document.createElement('h1');title.textContent='New badge!';const note=document.createElement('p');note.textContent=badge[3];
 const close=document.createElement('button');close.className='btn';close.textContent='Yay!';close.onclick=()=>notice.close();notice.onclose=()=>{notice.remove();if(previous?.isConnected&&previous!==document.body&&previous.matches('button,a[href],input,select,textarea,summary,[tabindex]')&&!previous.matches(':disabled')&&previous.getClientRects().length)previous.focus();else focusMain();};notice.onkeydown=event=>{if(event.key==='Tab'){event.preventDefault();close.focus();}};notice.append(symbol,title,note,close);document.body.append(notice);notice.showModal();close.focus();say('太棒了');
}
function creditWin(card,amount=1){
 const prior={count:S.pts[card.c]||0,sleeping:asleep(card)};touchStreak();S.stars+=amount;S.pts[card.c]=prior.count+1;S.ok??={};S.ok[card.c]=Date.now();return prior;
}
function celebrateWin(card,prior){
 if(prior.count<MASTER&&prior.count+1>=MASTER){pop(ANIMALS[mastered()-1]||'🎉');after(500,()=>pop('New friend!'));say('太棒了');}else pop(prior.sleeping?'☀️':'⭐');
 try{checkBadges();}catch(error){showStorageFailure(error);}
}
function win(card,amount=1){const prior=creditWin(card,amount);save();celebrateWin(card,prior);}
function shuffle(values){const result=[...values];let remaining=result.length;while(remaining>1){const index=Math.floor(Math.random()*remaining);remaining--;const value=result[remaining];result[remaining]=result[index];result[index]=value;}return result;}
function hdr(){
 const host=$('hd');host.replaceChildren();const profile=prof();
 const button=(label,text,action)=>{const item=document.createElement('button');item.className='pill';item.setAttribute('aria-label',label);item.textContent=text;item.onclick=action;host.append(item);return item;};
 if(profile){const switcher=button(`${profile.av||'🐼'} ${profile.name} ${ORD(GR())}, Switch learner`,profile.av||'🐼',who),name=document.createElement('span'),grade=document.createElement('span');name.className='nm';name.textContent=profile.name;grade.className='gb';grade.textContent=ORD(GR());switcher.append(' ',name,' ',grade);}
 button('Appearance','◐',showAppearance).classList.add('appearance-toggle');button('Grown-ups settings, press and hold','⚙️',()=>{}).id='gear';
 const stats=document.createElement('span');stats.className='pill legacy-stats';stats.textContent=`⭐ ${S.stars}`;const streak=document.createElement('span');streak.className='legacy-streak';streak.textContent=` · 🔥 ${S.streak}`;stats.append(streak);host.append(stats);gearHold();renderRewards();
}
function after(milliseconds,action){const token=NAV;setTimeout(()=>{if(token===NAV)action();},milliseconds);}
function screen({scroll=true}={}){
 viewNavigation={origin:document.activeElement};
 NAV++;detailRequest++;dclose();stopSpeech();feedbackQuestion=null;ACTIVE_REVIEW=null;document.body.dataset.screen='activity';$('home').style.display='inline-block';$('ttl').style.display='';$('grove-action-notice')?.setAttribute('hidden','');$('reward-notice')?.setAttribute('hidden','');$('progress-action-retry')?.remove();renderRewards();
 const navigation=NAV;if(scroll)requestAnimationFrame(()=>{if(NAV===navigation)window.scrollTo(0,0);});
}
function PF(){for(const card of batch()){if(!STROKES[card.c])SL(card.c,()=>{});}}
function home(){
 screen();delete document.body.dataset.study;document.body.dataset.screen='home';SESS=null;CRAM=null;TH=[];TF=[];writer=null;lq=[];mq=[];window._lp=window._fp=window._ts=0;
 archQ();$('home').style.display='none';A.innerHTML=groveHomeMarkup();hdr();checkBadges();after(1200,PF);
}
function characterBrowserScope(){const el=$('progress-characters');return el?{grade:el.dataset.grade,unit:el.dataset.unit}:null;}
function homeUnitKey(){const scope=characterBrowserScope();return [PR.cur||'_',scope?.grade||GR(),scope?.unit||''].join(':');}
function HSETS(scope=null){
 const grade=scope?.grade||GR();
 const built=GroveUnits.buildUnitGroups({units:U,cards:ALL,grade,selection:SET(),points:S.pts});
 const groups=scope?built.groups.filter(g=>g.g===grade&&!g.a&&(!scope.unit||g.c.join('')===scope.unit)):built.groups;
 return {o:groups,cur:groups.indexOf(built.groups[built.current]),ix:new Map(CARDS.map((card,index)=>[card.c,index]))};
}
function browserCards(){const chars=new Set(HSETS(characterBrowserScope()).o.flatMap(g=>g.c));return ALL.filter(c=>chars.has(c.c));}
function homeSets(){
 const host=$('sets');if(!host)return;const {o,cur}=HSETS(characterBrowserScope()),key=homeUnitKey();HS=o;
 HO[key]??=new Set(cur>=0?[o[cur].id]:characterBrowserScope()?.unit&&o[0]?[o[0].id]:[]);host.replaceChildren();const visitor=groveVisitorNote();if(visitor)host.insertAdjacentHTML('beforeend',visitor);
 if(cur>=0){const note=document.createElement('p');note.className='hsum';note.textContent=`Reward stars: ${o[cur].f} · ${o[cur].c.filter(char=>(S.pts[char]||0)>=MASTER).length}/${o[cur].c.length} ⭐`;host.append(note);}
 let previous='';
 o.forEach((group,index)=>{
  const sectionKey=[group.g,group.a,group.supplemental].join(':');
  if(sectionKey!==previous){previous=sectionKey;const heading=document.createElement('div');heading.className='gh';const title=document.createElement('h3');title.textContent=`${GN[group.g]||'Other'} · ${group.supplemental?'Supplemental practice':group.a?'Other selected units':'PDF units'}`;
   const count=document.createElement('span'),peers=o.filter(row=>row.g===group.g&&row.a===group.a&&row.supplemental===group.supplemental);count.textContent=`${peers.filter(row=>row.c.every(char=>(S.pts[char]||0)>=MASTER)).length} of ${peers.length} ${group.supplemental?'sets':'units'} with all stars`;heading.append(title,count);host.append(heading);
   if(group.supplemental||group.a){const note=document.createElement('p');note.className='reading-note';note.textContent=group.supplemental?'Extra characters outside the PDF unit list.':'Full PDF units containing your additional selected characters.';host.append(note);}
  }
  const complete=group.c.filter(char=>(S.pts[char]||0)>=MASTER).length,open=HO[key].has(group.id),growth=unitGroveGrowth(group.c);
  const row=document.createElement('div');row.className=['set',index===cur?'cur':'',complete===group.c.length?'done':'',open?'open':''].filter(Boolean).join(' ');
  const toggle=document.createElement('button');toggle.setAttribute('aria-expanded',String(open));toggle.id='unit-'+encodeURIComponent(group.id);toggle.setAttribute('aria-description',`${group.f}. ${complete} of ${group.c.length} characters have five reward stars.`);toggle.onclick=()=>HTG(group.id);
  toggle.innerHTML=`<span class="unit-tree" aria-hidden="true">${groveTree('unit',growth.stage)}</span><span class="tt">${esc(group.t)}</span><span class="pv" aria-hidden="true">${open?'':group.c.map(esc).join(' ')}</span><span class="grove-growth">${growth.practiced}/${group.c.length} practiced · ${growth.badges} badges</span><span class="st">${complete}/${group.c.length} ${complete===group.c.length?'✓':'⭐'}</span><span class="cv" aria-hidden="true">⌄</span>`;row.append(toggle);
  if(open){const grid=document.createElement('div');grid.className='zoo';for(const [position,char]of group.c.entries()){
    const card=ALL.find(card=>card.c===char);if(!card)continue;const points=S.pts[char]||0,tile=document.createElement('button');tile.className='z character-tile';tile.setAttribute('aria-description',`${Math.min(points,MASTER)} of 5 reward stars`);tile.onclick=()=>DSET(index,position);
    tile.innerHTML=`<span class="ch" lang="zh-Hans">${esc(char)}${asleep(card)?'<sup>💤</sup>':''}</span><span class="py" lang="zh-Latn-pinyin">${esc(card.p)}</span><span class="dots">${Array.from({length:MASTER},(_,n)=>`<i class="${n<points?'on':''}"></i>`).join('')}</span>`;grid.append(tile);
   }const practice=document.createElement('button');practice.className='pset';practice.textContent=`▶ Practice this ${group.supplemental?'set':'unit'}`;practice.onclick=()=>PSET(index);row.append(grid,practice);
  }host.append(row);
 });updateGroveView();
}
function HTG(id){const expanded=HO[homeUnitKey()]??=new Set();expanded.has(id)?expanded.delete(id):expanded.add(id);homeSets();const toggle=$('unit-'+encodeURIComponent(id));toggle?.focus({preventScroll:true});toggle?.scrollIntoView({block:'nearest'});}
function PSET(index){const group=HS[index];if(group)showStudySetup('practice',group.c.map(char=>ALL.find(card=>card.c===char)).filter(Boolean));}
function selectPractice(chars){S.cfg.set=[...new Set(chars)];save();setCards();lq=[];mq=[];}
function next10(quiet=false){const group=NCH(),added=group?.c.filter(char=>!SET().includes(char))||[];if(added.length){const previous=SET();selectPractice(previous.concat(added));if(!quiet){cat();undoT(previous,'Added '+added.length);}}else if(!quiet)pop('Every character in this grade is already in practice.');return added.length;}
function undoT(previous,message){
 document.querySelectorAll('.undo').forEach(node=>node.remove());const notice=document.createElement('div');notice.className='undo';notice.textContent=message+' ';const undo=document.createElement('button');undo.textContent='Undo';undo.onclick=()=>{selectPractice(previous);notice.remove();cat();};notice.append(undo);document.body.append(notice);setTimeout(()=>notice.remove(),5000);
}
function catT(char){const previous=SET();if(previous.includes(char)&&previous.length<=4){pop('Keep at least 4 characters in practice.');return;}selectPractice(previous.includes(char)?previous.filter(value=>value!==char):previous.concat(char));cat({focusChar:char});}
function catAll(){const previous=SET(),add=ALL.filter(card=>(!catG||card.g.includes(catG))&&!previous.includes(card.c)).map(card=>card.c);if(add.length&&confirm(`Add ${add.length} characters to practice?`)){selectPractice(previous.concat(add));cat();undoT(previous,'Added '+add.length);}}
function catNone(){const previous=SET(),remaining=previous.filter(char=>catG&&!ALL.find(card=>card.c===char)?.g.includes(catG));if(previous.length===remaining.length)return;if(confirm('Remove these characters from practice? Stars and progress stay.')){selectPractice(remaining.length>=4?remaining:[]);cat();undoT(previous,'Practice selection changed');}}
function cat({focusChar=null}={}){
 screen({scroll:!focusChar});A.innerHTML='<h1>All characters</h1><p class="reading-note">Choose characters for practice. Your earned progress stays yours.</p><input id="cq" type="search" aria-label="Search all characters" placeholder="Character, pinyin, or meaning"><div class="catalog-grades"></div><p class="cst"></p><div class="catalog-actions"></div><div class="catalog-results"></div>';
 const grades=A.querySelector('.catalog-grades');for(const grade of ['',...Object.keys(GN)]){const button=document.createElement('button');button.className='chip';button.textContent=grade?`${GN[grade]} (${gList(grade).length})`:'All';button.setAttribute('aria-pressed',String(catG===grade));button.onclick=()=>{catG=grade;cat();};grades.append(button);}
 A.querySelector('.cst').textContent=`Practicing ${CARDS.length} characters`;
 for(const [label,action]of [['＋ Add next unit',()=>next10()],['＋ Add '+(GN[catG]||'all grades'),catAll],['− Remove '+(GN[catG]||'all'),catNone]]){const button=document.createElement('button');button.className='cb';button.textContent=label;button.onclick=action;A.querySelector('.catalog-actions').append(button);}
 const input=$('cq'),results=A.querySelector('.catalog-results');input.value=catQ;
 const render=()=>{
  const query=catQ.trim().toLowerCase(),key=pinyinBase(query).replace(/[1-5\s]/g,''),cards=ALL.filter(card=>(!catG||card.g.includes(catG))&&(!query||card.c.includes(query)||card.m.toLowerCase().includes(query)||readings(card).some(reading=>pinyinBase(reading).startsWith(key))));
  results.replaceChildren();if(!cards.length){const empty=document.createElement('p');empty.setAttribute('role','status');empty.textContent='No matches. Try another character, pinyin or meaning.';results.append(empty);}const letters=new Map();for(const card of cards){const initial=pinyinBase(card.p)[0].toUpperCase();if(!letters.has(initial))letters.set(initial,[]);letters.get(initial).push(card);}
  for(const [letter,cards]of [...letters].sort(([a],[b])=>a.localeCompare(b))){const title=document.createElement('h2');title.id='L_'+letter;title.textContent=letter;const grid=document.createElement('div');grid.className='zoo';
   for(const card of cards){const tile=document.createElement('div');tile.className='z';const glyph=document.createElement('button');glyph.className='ch';glyph.textContent=card.c;glyph.onclick=()=>detail(0,[card]);const pinyin=document.createElement('div');pinyin.className='py';pinyin.textContent=card.p;const meaning=document.createElement('div');meaning.className='mean';meaning.textContent=card.m;const add=document.createElement('button');add.className='chip';const active=SET().includes(card.c);add.dataset.practiceChar=card.c;add.setAttribute('aria-label',(active?'✓ Practicing':'＋ Add')+' '+card.c+(active?', remove from practice':', add to practice'));glyph.lang='zh-Hans';pinyin.lang='zh-Latn-pinyin';add.textContent=active?'✓ Practicing':'＋ Add';add.onclick=()=>catT(card.c);tile.append(glyph,pinyin,meaning,add);grid.append(tile);}results.append(title,grid);
  }
 };input.oninput=()=>{catQ=input.value;render();};render();if(focusChar)[...results.querySelectorAll('[data-practice-char]')].find(el=>el.dataset.practiceChar===focusChar)?.focus();
}
function zooScreen(){
 screen();A.innerHTML='<h1>My Zoo</h1><p class="mean"></p><div class="zoo"></div><h2>Bonus badges</h2><p class="reading-note">Streak badges are optional extras. My badges has practice challenges you can earn any day.</p><button class="btn" id="zoo-badges">My badges</button><div class="zoo bonus-badges"></div>';
 const count=groveZooFriends(S,ANIMALS,MASTER).length;A.querySelector('.mean').textContent=`${count} friends · earn character stars to meet the next one`;
 for(const [index,animal]of ANIMALS.entries()){const tile=document.createElement('div');tile.className='z'+(index<count?'':' lock');tile.textContent=index<count?animal+' '+ANIMAL_NAMES[index]:'❔ Friend '+(index+1)+' · Not earned yet';A.querySelector('.zoo').append(tile);}
 for(const badge of BADGES){const tile=document.createElement('div');tile.className='z'+(S.bad?.[badge[0]]?'':' lock');tile.textContent=badge[1]+' '+badge[2]+' · '+(S.bad?.[badge[0]]?'Earned':'Not earned yet');tile.title=badge[3];A.querySelector('.bonus-badges').append(tile);}$('zoo-badges').onclick=rewardCollection;
}
function TESTD(){if(!S.cfg.test)return null;const [year,month,day]=S.cfg.test.split('-').map(Number);return new Date(year,month-1,day);}
function daysLeft(){const test=TESTD();if(!test)return null;const day=new Date();day.setHours(0,0,0,0);return Math.round((test-day)/DAY);}
function UQ(){return [QU().map(([,chars])=>chars),QU().map(([number])=>number)];}
function UN(chars=S.cfg.quiz){return QU().find(([,value])=>value===chars)?.[0]||0;}
function NXT(chars){const units=QU(),index=units.findIndex(([,value])=>value===chars);return index>=0?units[index+1]?.[1]||'':'';}
function archQ(){
 if(daysLeft()!==null&&daysLeft()<0&&S.cfg.quiz){const chars=S.cfg.quiz;S.cfg.past=[{...(S.cfg.past||[]).find(row=>row.q===chars),q:chars,d:S.cfg.test},...(S.cfg.past||[]).filter(row=>row.q!==chars)];S.cfg.quiz=NXT(chars);S.cfg.test='';save();}
}
function QZ(chars=S.cfg.quiz||''){return [...chars].filter(char=>ALL.some(card=>card.c===char));}
function QOPT(grade){return '<option value="">Custom (type below)</option>'+QU(grade).map(([number,chars])=>`<option value="${esc(chars)}"${chars===S.cfg.quiz?' selected':''}>Unit ${number} · ${esc(chars)}</option>`).join('');}
function QSW(grade){const list=QU(grade),input=$('gq'),select=$('gu');$('gul').style.display=list.length?'':'none';if(select.value&&!list.some(([,chars])=>chars===input.value))input.value='';select.innerHTML=QOPT(grade);select.value=list.some(([,chars])=>chars===input.value)?input.value:'';}
function qList(){
 screen();A.innerHTML='<h1>📚 Quizzes</h1><p class="mean">Tap one to practice it.</p>';
 const done=new Set((S.cfg.past||[]).map(row=>row.q));
 for(const [number,chars]of QU()){const button=document.createElement('button');button.className='today quiz-unit'+(chars===S.cfg.quiz?' is-current':done.has(chars)?' is-done':'');button.innerHTML=`<span><b>${done.has(chars)?'✓ ':''}Unit ${number}${chars===S.cfg.quiz?' · next quiz':''}</b><small lang="zh-Hans">${[...chars].map(esc).join(' ')}</small></span><span class="go">▶ Start</span>`;button.onclick=()=>studyQuiz(chars);A.append(button);}
 if(S.cfg.past?.some(row=>!QU().some(([,chars])=>chars===row.q))){const button=document.createElement('button');button.className='btn gray';button.textContent='Past quizzes';button.onclick=pastQ;A.append(button);}
}
function pastQ(){screen();A.innerHTML='<h1>Past quizzes</h1><p class="mean">Tap one to try it again.</p>';for(const quiz of S.cfg.past||[]){const button=document.createElement('button');button.className='today';button.innerHTML=`<span lang="zh-Hans">${QZ(quiz.q).map(esc).join(' ')}</span> · Test on ${esc(quiz.d||'—')} · ▶ Start`;button.onclick=()=>dictStart(quiz.q);A.append(button);}}
function startSession(pool=CARDS,title=''){SESS={q:progressiveQueue(S,pool,10,KG(),Date.now(),shuffle,Number(GR())>=2),i:0,t:title,pool};nextItem();}
function RS(){const round=S.cfg.rs;if(!round?.q||round.i>=round.q.length)return null;return round.q.every(([,char])=>CARDS.some(card=>card.c===char))?round:null;}
function resume(){
 if(!resumeLegacyRound('rs'))return showStudySetup('practice');const round=RS();if(!round)return startSession();const by=new Map(CARDS.map(card=>[card.c,card]));SESS={q:round.q.map(([mode,char])=>[mode,by.get(char)]),i:round.i,t:round.t||'',pool:(round.p||[]).map(char=>by.get(char)).filter(Boolean)};nextItem();
}
function nextItem(){
 try{
 if(!SESS)return;if(SESS.study)return studyNextItem();
 if(SESS.i>=SESS.q.length){const session=SESS;delete S.cfg[session.cram?'cram':'rs'];save();SESS=null;screen();A.innerHTML='<div class="big">🎉</div><h1>Round done!</h1><p class="mean"></p><button class="btn" id="again">Practice again</button><button class="btn gray" id="round-choices">Choose units / mode</button><button class="btn gray" id="round-home">Back home</button>';A.querySelector('.mean').textContent=`You finished ${session.q.length} activities. Stars celebrate practice; the Parent dashboard shows learning mastery.`;$('again').onclick=()=>CRAM?startCram(CRAM.mode,true):startSession(session.pool,session.t);$('round-choices').onclick=()=>CRAM?showCram():showStudySetup('practice');$('round-home').onclick=home;return;}
 saveRound();const [mode,card]=SESS.q[SESS.i++],actions={trace:()=>trace(practiceCards().indexOf(card)),listen:()=>listen(card),flip:()=>flip(card),memory:()=>memory(card),dictation:()=>dictQuestion(card)};actions[mode]?.();
 }catch(error){if(error.groveSaveRejected)error.groveRetryAction=nextItem;throw error;}
}
function go(action){skipReview();if(SESS)nextItem();else action();}
function sessBar(){if(SESS?.study)return studySessionBar();return SESS?`<div class="sess">${SESS.i} / ${SESS.q.length}<div class="bar"><i style="width:${100*SESS.i/SESS.q.length}%"></i></div></div>`:'';}
function SL(char,done,onError=()=>{}){
 if(STROKES[char]){done(STROKES[char]);return;}
 if(!strokeRequests.has(char))strokeRequests.set(char,fetch('strokes/'+encodeURIComponent(char)+'.json').then(response=>{if(!response.ok)throw Error('Stroke data unavailable');return response.json();}).then(data=>{if(!Array.isArray(data.strokes)||!Array.isArray(data.medians))throw Error('Invalid stroke data');STROKES[char]=data;return data;}).finally(()=>strokeRequests.delete(char)));
 strokeRequests.get(char).then(done,onError);
}
function DSET(group,index){const chars=HS[group]?.c||[];detail(index,chars.map(char=>ALL.find(card=>card.c===char)).filter(Boolean));}
function detail(index,cards=CARDS){
 if(!cards.length)return;DL=cards;DI=(index%cards.length+cards.length)%cards.length;const card=DL[DI],request=++detailRequest,navigation=NAV;
 if(!STROKES[card.c]){SL(card.c,()=>{if(detailRequest===request&&NAV===navigation)detail(DI,DL);},()=>{if(detailRequest===request&&NAV===navigation)pop('Could not load strokes. Try opening this character again.');});return;}
 const existing=$('dov');if(!existing)detailReturnFocus=document.activeElement;existing?.remove();const overlay=document.createElement('div');overlay.id='dov';overlay.className='modal-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',card.c+' character details');
 overlay.innerHTML='<div id="dcard"><button class="detail-close" aria-label="Close">✕</button><div class="detail-navigation"><button aria-label="Previous">‹</button><div id="dhw"></div><button aria-label="Next">›</button></div><p class="prog">Tap the character to see its strokes</p><div class="detail-reading"></div><div class="detail-meaning mean"></div><div class="detail-example"></div><p class="detail-progress prog"></p><div class="detail-actions"><button class="btn" id="detail-watch">▶ Watch strokes</button><button class="btn" id="detail-practice">✏️ Practice</button></div></div>';
 overlay.querySelector('.detail-reading').textContent=card.p;const sound=document.createElement('button');sound.className='btn gray detail-sound';sound.textContent='🔊 Hear pronunciation';sound.onclick=()=>say(card.c);overlay.querySelector('.detail-reading').append(sound);overlay.querySelector('.detail-meaning').textContent=card.m;overlay.querySelector('.detail-example').innerHTML=wordLine(card);overlay.querySelector('.detail-progress').textContent=`${STROKES[card.c].strokes.length} strokes · ${'⭐'.repeat(Math.min(MASTER,S.pts[card.c]||0))}${'☆'.repeat(Math.max(0,MASTER-(S.pts[card.c]||0)))}`;
 overlay.onclick=event=>{if(event.target===overlay)dclose();};overlay.querySelector('.detail-close').onclick=dclose;overlay.querySelector('[aria-label="Previous"]').onclick=()=>detail(DI-1,DL);overlay.querySelector('[aria-label="Next"]').onclick=()=>detail(DI+1,DL);
 let touch=null;
 overlay.addEventListener('touchstart',event=>{touch=null;if(event.touches.length!==1||event.target.closest('button,#dhw'))return;const point=event.touches[0];touch={id:point.identifier,x:point.clientX,y:point.clientY};},{passive:true});
 overlay.addEventListener('touchcancel',()=>touch=null,{passive:true});
 overlay.addEventListener('touchend',event=>{const start=touch;touch=null;if(!start||!overlay.isConnected)return;const end=[...event.changedTouches].find(point=>point.identifier===start.id);if(!end)return;const horizontal=end.clientX-start.x,vertical=end.clientY-start.y;if(Math.abs(horizontal)>60&&Math.abs(horizontal)>Math.abs(vertical))detail(DI+(horizontal<0?1:-1),DL);else if(vertical>90&&vertical>Math.abs(horizontal))dclose();},{passive:true});
 document.body.append(overlay);
 const size=$('dhw').clientWidth;dw=WritingSurface.create($('dhw'),card.c,{width:size,height:size,padding:14,strokeColor:'#1F2937',strokeAnimationSpeed:1.3,delayBetweenStrokes:120,charDataLoader:SL});$('dhw').onclick=()=>dw?.animateCharacter();$('detail-watch').onclick=()=>dw?.animateCharacter();$('detail-practice').onclick=()=>PRAC(card);overlay.querySelector('.detail-close').focus();say(card.c);
}
function PRAC(card){dclose();showStudySetup('practice',[card]);}
function dclose(){detailRequest++;$('dov')?.remove();dw=null;if(detailReturnFocus?.isConnected)detailReturnFocus.focus();detailReturnFocus=null;}
function srch(value){
 const query=value.trim().toLowerCase(),key=pinyinBase(query).replace(/[1-5\s]/g,''),tone=/[1-4]/.exec(query)?.[0],host=$('sres'),status=$('search-status');
 host.replaceChildren();status.textContent='';if(!query)return;
 const pool=browserCards(),found=pool.filter(card=>card.c===query||card.m.toLowerCase().includes(query)||readings(card).some(reading=>pinyinBase(reading).startsWith(key)&&(!tone||pinyinTone(reading)===Number(tone))));
 for(const card of found){const button=document.createElement('button');button.className='z character-tile';button.innerHTML=`<span class="ch" lang="zh-Hans">${esc(card.c)}</span> <span class="py" lang="zh-Latn-pinyin">${esc(card.p)}</span>`;button.onclick=()=>detail(pool.indexOf(card),pool);host.append(button);}
 status.textContent=found.length?`${found.length} ${found.length===1?'character':'characters'} found in these units.`:'No characters found in these units. Try a character, pinyin or English meaning, or choose another Grade or Unit.';
}
function backup(){return GROVE_REPOSITORY.exportBackup();}
$('ttl').onclick=()=>{if(prof())home();};$('totop').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});$('report-problem')?.addEventListener('click',()=>showFeedback());
addEventListener('scroll',()=>$('totop')?.classList.toggle('show',scrollY>innerHeight*1.5),{passive:true});
document.addEventListener('keydown',event=>{const overlay=$('dov');if(!overlay)return;if(event.key==='Escape'){event.preventDefault();dclose();}else if(event.key==='ArrowLeft')detail(DI-1,DL);else if(event.key==='ArrowRight')detail(DI+1,DL);else if(event.key==='Tab'){const controls=[...overlay.querySelectorAll('button')],first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
let LAST=Date.now();for(const event of ['pointerdown','keydown'])addEventListener(event,()=>LAST=Date.now(),{capture:true});function idleChk(){if(PR.list.length>1&&Date.now()-LAST>30*60*1000){LAST=Date.now();who();}}setInterval(idleChk,60000);
try{PR=GROVE_REPOSITORY.readRegistry();GROVE_SAVED_REGISTRY=JSON.parse(JSON.stringify(PR));loadS();hdr();if(PR.list.length>1)who();else if(PR.list.length)home();else setup(true);}catch(error){showProgressRecovery(error);}
