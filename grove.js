// Grove presentation only. Reward rules/catalog/state live in rewards.js.
const GROVE_MODE_COLORS={trace:'var(--canopy-trace)',listen:'var(--canopy-listen)',flip:'var(--canopy-flip)',memory:'var(--canopy-memory)',unit:'var(--canopy-unit)',writing:'var(--canopy-trace)'};
function groveTree(mode='unit',growth=3){
 const skin=groveEquipped(S).trees,color=skin==='violet-leaves'?'var(--violet)':skin==='golden-leaves'?'var(--scene-sun)':GROVE_MODE_COLORS[mode]||GROVE_MODE_COLORS.unit;
 if(growth===0)return '<svg viewBox="0 0 90 90" aria-hidden="true"><path d="M14 73H76" stroke="var(--tree-ground)" stroke-width="3" stroke-linecap="round"/><path d="M45 72V52" stroke="var(--tree-ink)" stroke-width="5"/><path d="M45 57C26 59 26 38 26 38C44 36 48 47 45 57ZM46 52C45 36 65 30 65 30C70 46 60 56 46 52Z" fill="'+color+'"/></svg>';
 return '<svg viewBox="0 0 90 90" aria-hidden="true"><path d="M18 78H72" stroke="var(--tree-ground)" stroke-width="3" stroke-linecap="round"/><path d="M46 76V34M46 59L27 45M46 49L63 33" fill="none" stroke="var(--tree-ink)" stroke-width="5" stroke-linecap="round"/><path d="M24 51C4 49 10 26 20 24C12 7 40 3 46 16C65 3 82 21 73 34C89 47 67 64 55 54C43 67 28 61 24 51Z" fill="'+color+'"/><path d="M46 75V42M46 60L29 48M46 52L62 38" fill="none" stroke="var(--tree-ink)" stroke-width="4" stroke-linecap="round"/>'+(growth>1?'<circle cx="25" cy="34" r="7" fill="var(--ac)"/><circle cx="62" cy="31" r="7" fill="var(--ac)"/>':'')+(growth>2?'<circle cx="61" cy="51" r="7" fill="var(--ac)"/>':'')+'</svg>';
}
function groveProjectArt(id,stage){
 const piece=(n,svg)=>stage>=n?`<g data-piece="${n}">${svg}</g>`:'';
 if(id==='reading-nook')return piece(1,'<ellipse cx="57" cy="94" rx="53" ry="14" fill="var(--ac)" opacity=".8"/><path d="M16 94H98M24 100H90" stroke="var(--paper)" stroke-width="2"/>')+piece(2,'<rect x="67" y="52" width="34" height="40" rx="2" fill="var(--tree-ink)"/><path d="M71 71H97" stroke="var(--paper)" stroke-width="2"/><path d="M75 56V68M82 56V68M90 57L94 68M76 77V87M84 77V87M92 77V87" stroke="var(--violet)" stroke-width="5"/>')+piece(3,'<rect x="21" y="78" width="36" height="16" rx="8" fill="var(--violet)" stroke="var(--violet-ink)" stroke-width="2"/><path d="M28 84H49" stroke="var(--paper)" stroke-width="2"/>')+piece(4,'<path d="M12 89V28M105 89V28" stroke="var(--tree-ink)" stroke-width="3"/><path d="M5 28L58 5L113 28Q90 46 58 29Q26 46 5 28Z" fill="var(--violet)" stroke="var(--violet-ink)" stroke-width="2"/>');
 return piece(1,'<path d="M44 47L29 104M59 47L44 104M39 65H54M35 79H50M32 93H46" stroke="var(--tree-ink)" stroke-width="4" stroke-linecap="round"/>')+piece(2,'<path d="M4 48H105L98 55H12Z" fill="var(--ac)" stroke="var(--tree-ink)" stroke-width="2"/>')+piece(3,'<rect x="15" y="14" width="79" height="33" fill="var(--scene-path)" stroke="var(--tree-ink)" stroke-width="2"/><rect x="44" y="22" width="23" height="21" rx="3" fill="var(--violet)"/><path d="M55 22V43M44 32H67" stroke="var(--paper)" stroke-width="2"/>')+piece(4,'<path d="M4 15L55 -9L105 15Z" fill="var(--violet)" stroke="var(--violet-ink)" stroke-width="2"/>');
}
function groveSceneDecorations(e){
 const wrap=(slot,svg)=>e[slot]?`<g data-scene="${e[slot]}">${svg}</g>`:'';
 let sky='',ground='',furniture='';
 if(e.sky==='sunrise')sky='<circle cx="350" cy="76" r="65" fill="var(--ac)" opacity=".18"/><path d="M275 72H256M426 72H445M350 2V15M295 20L282 8M409 20L422 8" stroke="var(--ac)" stroke-width="5" stroke-linecap="round"/>';
 if(e.sky==='kite')sky='<path d="M110 39L126 63L110 85L94 63Z" fill="var(--violet)" stroke="var(--violet-ink)" stroke-width="2"/><path d="M110 40V85M95 63H125M110 85Q82 104 117 118Q151 134 120 151" fill="none" stroke="var(--violet-ink)" stroke-width="1.5"/>';
 if(e.sky==='rainbow')sky='<path d="M61 109A135 110 0 0 1 331 109" fill="none" stroke="var(--ac)" stroke-width="10" opacity=".7"/><path d="M72 110A124 99 0 0 1 320 110" fill="none" stroke="var(--scene-sun)" stroke-width="9"/><path d="M82 111A114 89 0 0 1 310 111" fill="none" stroke="var(--violet)" stroke-width="9"/>';
 if(e.sky==='starry-sky')sky='<path d="M365 35A30 30 0 1 0 388 79A31 31 0 0 1 365 35" fill="var(--paper)"/><path d="M95 45V58M89 51H101M154 21V33M148 27H160M413 111V125M406 118H420M224 17V26M220 21H228" stroke="var(--violet-ink)" stroke-width="3" stroke-linecap="round"/>';
 if(e.ground==='flowers')ground=[25,46,72,92].map((x,i)=>`<path d="M${x} 290V${265+i%2*10}" stroke="var(--tree-ink)" stroke-width="2"/><circle cx="${x}" cy="${265+i%2*10}" r="7" fill="${i%2?'var(--violet)':'var(--paper)'}"/><circle cx="${x}" cy="${265+i%2*10}" r="3" fill="var(--ac)"/>`).join('');
 if(e.ground==='stepping-stones')ground=[0,1,2,3,4].map(i=>`<ellipse cx="${90+i*37}" cy="${294-i*6}" rx="13" ry="5" fill="var(--tree-ground)" stroke="var(--tree-ink)"/>`).join('');
 if(e.ground==='mushrooms')ground='<path d="M42 287V274M76 294V282" stroke="var(--paper)" stroke-width="7"/><path d="M24 275Q42 247 60 275Z" fill="var(--ac)"/><path d="M63 282Q76 262 89 282Z" fill="var(--violet)"/><circle cx="37" cy="268" r="3" fill="var(--paper)"/><circle cx="47" cy="271" r="2" fill="var(--paper)"/>';
 if(e.ground==='pond')ground='<ellipse cx="67" cy="281" rx="47" ry="17" fill="var(--canopy-memory)" stroke="var(--tree-ink)" stroke-width="2"/><ellipse cx="75" cy="279" rx="14" ry="5" fill="var(--canopy-listen)"/><path d="M75 279L90 275" stroke="var(--tree-ink)" stroke-width="1"/>';
 if(e.furniture==='book-basket')furniture='<path d="M259 257H298L292 280H265Z" fill="var(--scene-sun)" stroke="var(--tree-ink)" stroke-width="2"/><path d="M266 257V245H278V257M281 257V240H291V257" fill="var(--violet)" stroke="var(--violet-ink)" stroke-width="2"/><path d="M265 264H293M267 271H292" stroke="var(--tree-ink)" opacity=".5"/>';
 if(e.furniture==='lantern')furniture='<path d="M278 280V231H298V238" fill="none" stroke="var(--tree-ink)" stroke-width="3"/><rect x="286" y="240" width="25" height="29" rx="10" fill="var(--ac)" stroke="var(--tree-ink)" stroke-width="2"/><path d="M292 242V266M304 242V266M298 269V278" stroke="var(--scene-path)" stroke-width="2"/>';
 if(e.furniture==='bench')furniture='<path d="M253 279V254M305 279V254" stroke="var(--tree-ink)" stroke-width="4"/><rect x="248" y="249" width="63" height="10" rx="3" fill="var(--scene-sun)" stroke="var(--tree-ink)" stroke-width="2"/><rect x="252" y="232" width="55" height="12" rx="3" fill="var(--scene-sun)" stroke="var(--tree-ink)" stroke-width="2"/>';
 if(e.furniture==='birdbath')furniture='<path d="M280 250V279M267 280H294" stroke="var(--tree-ink)" stroke-width="6" stroke-linecap="round"/><path d="M257 240Q280 266 304 240Z" fill="var(--canopy-memory)" stroke="var(--tree-ink)" stroke-width="2"/><ellipse cx="280" cy="240" rx="23" ry="5" fill="var(--canopy-listen)"/>';
 return {sky:wrap('sky',sky),ground:wrap('ground',ground),furniture:wrap('furniture',furniture)};
}
function groveVisitorIcon(){
 const id=groveEquipped(S).visitors;if(!id)return '';
 if(id.startsWith('zoo:'))return groveZooFriends(S,ANIMALS,MASTER)[Number(id.slice(4))]||'';
 return GROVE_REWARD_CATALOG.find(r=>r.id===id)?.icon||'';
}
function groveVisitorNote(){const icon=groveVisitorIcon();return icon?`<p class="grove-visitor">${icon} A friend is visiting your grove.</p>`:'';}
function groveLandscape(){
 const e=groveEquipped(S),decor=groveSceneDecorations(e),projects=groveWallet(S).projects||{},visitor=groveVisitorIcon();
 return `<svg class="grove-landscape" viewBox="0 0 480 310" aria-hidden="true">${e.sky==='starry-sky'?'':'<circle cx="351" cy="69" r="35" fill="var(--scene-sun)"/>'}${decor.sky}<path d="M0 245Q110 180 245 239Q380 180 480 228V310H0Z" fill="var(--scene-back)"/><path d="M0 273Q150 212 295 267Q410 222 480 259V310H0Z" fill="var(--scene-front)"/><path d="M95 287Q219 251 350 295" fill="none" stroke="var(--scene-path)" stroke-width="20"/>
 <g ${e.trees?`data-scene="${e.trees}"`:''}><g transform="translate(168 26) scale(2.5)">${groveTree('unit').replace(/<\/?svg[^>]*>/g,'')}</g><g transform="translate(28 139) scale(1.25)">${groveTree('flip',2).replace(/<\/?svg[^>]*>/g,'')}</g><g transform="translate(356 156) scale(.98)">${groveTree('listen',1).replace(/<\/?svg[^>]*>/g,'')}</g>${e.trees==='blossoms'?[['235','98'],['290','135'],['331','87'],['88','178']].map(([x,y])=>`<text x="${x}" y="${y}" font-size="23">🌸</text>`).join(''):''}${e.trees==='wishing-tree'?'<path d="M242 104V139L250 132L258 139V104M308 133V168L315 162L323 168V133" fill="var(--violet)" stroke="var(--violet-ink)"/>':''}</g>
 ${projects.treehouse?.visible!==false&&projects.treehouse?.stage?`<g data-project-scene="treehouse" transform="translate(244 129) scale(.8)">${groveProjectArt('treehouse',projects.treehouse.stage)}</g>`:''}${projects['reading-nook']?.visible!==false&&projects['reading-nook']?.stage?`<g data-project-scene="reading-nook" transform="translate(343 209) scale(.8)">${groveProjectArt('reading-nook',projects['reading-nook'].stage)}</g>`:''}
 ${decor.ground}${decor.furniture}<path d="M166 279Q186 269 205 281Q225 269 244 279V301Q225 294 205 306Q187 294 166 301Z" fill="var(--violet)" stroke="var(--violet-ink)" stroke-width="2"/><path d="M205 281V306" stroke="var(--paper)" stroke-width="2"/>${visitor?`<g data-scene="${e.visitors}"><text x="119" y="258" font-size="32">${visitor}</text></g>`:''}</svg>`;
}
function groveReadinessMarkup(){
 const cards=batch(),result=unitReadiness(S,cards.map(c=>c.c),GR());if(!cards.length)return '';
 return `<aside class="grove-readiness ${result.ready?'is-ready':''}" data-unit-readiness><div><b>${result.ready?'🌱 Ready for more':`${result.completed}/${result.total} characters ready`}</b><details><summary>How it works</summary><p>Two independent successes in ${GR()==='K'?'listening':Number(GR())>=2?'listening, writing recall, and pinyin where needed':'listening and writing recall'} per character. Keep this week’s schoolwork as long as you like; earlier characters stay in review.</p></details></div><button class="btn gray" onclick="showGroveUnitChooser()">${result.ready?'Add another unit':'Choose units'}</button></aside>`;
}
function showGroveUnitChooser(){
 screen();SESS=null;CRAM=null;const selected=new Set(SET());
 A.innerHTML=`<h1>Choose another unit</h1><p class="reading-note">Follow your class or explore ahead. Units can be added in any order, at any time. Earlier characters stay in practice for review. This keeps your school quiz settings.</p><div class="grove-unit-choices">${CHK().map((h,i)=>{const count=h.c.filter(c=>!selected.has(c)).length;return `<section><h2>${h.k} ${h.n}</h2><p lang="zh-Hans">${h.c.join(' ')}</p><button class="btn ${count?'':'gray'}" onclick="groveAddUnit(${i})" ${count?'':'disabled'} aria-label="${count?'Add':'Already practicing'} ${h.k} ${h.n}">${count?`Add ${count} character${count===1?'':'s'}`:'Already in practice'}</button></section>`}).join('')}</div><button class="btn gray" onclick="home()">Keep my current units</button>`;
}
function groveAddUnit(index){
 const unit=CHK()[index];if(!unit)return;
 const selected=[...SET()],added=unit.c.filter(c=>!selected.includes(c));if(!added.length)return;
 S.cfg.set=selected.concat(added);save();setCards();lq=[];mq=[];home();groveActionNotice(`${unit.k} ${unit.n} added. Earlier characters stay in review.`);
}
function groveGoalMarkup(clear=false){
 const goal=groveGoalStatus(S);if(!goal)return '';
 return `<aside class="grove-goal"><span aria-hidden="true">${goal.icon}</span><div><small>GROWING NEXT</small><b>${goal.name}</b><p>${goal.remaining?`${goal.remaining} more orange${goal.remaining===1?'':'s'} to go`:'You have enough oranges!'}</p><progress max="${goal.cost}" value="${Math.min(goal.cost,groveWallet(S).balance)}" aria-label="Oranges toward ${goal.name}"></progress>${clear?'<button class="grove-goal-clear" data-grove-control="clear-goal" onclick="grovePin(null)">Clear goal</button>':''}</div><button onclick="groveShowGoal()">Your goal ↗</button></aside>`;
}
function groveHomeMarkup(dl){
 const practice=currentStudyRound('practice'),review=currentStudyRound('review'),wallet=groveWallet(S);
 return `<div class="grove-home">
 <section class="grove-hero study-home-hero"><div class="grove-hero-copy"><h1 class="hello">你好, ${esc(prof()?.name||'friend')}<span>Your Mandarin Grove</span></h1><p>Choose your characters. Grow a little today.</p></div><div class="grove-hero-art">${groveLandscape()}</div></section>
 <div class="study-home-entries"><button class="grove-daily" aria-label="Practice" onclick="showStudySetup('practice')"><b>Practice</b><small>Build skills with help</small><span>${practice?'Continue or choose a new round':'Choose units, characters & activities'} ↗</span></button><button class="study-review-entry" aria-label="Review" onclick="showStudySetup('review')"><b>Review</b><small>Check what you remember</small><span>${review?'Continue or choose a new round':'Choose units, characters & activities'} ↗</span></button></div>
 <div class="grove-resume-links">${practice?`<button onclick="resumeStudy('practice')">Resume practice · ${practice.cursor}/${practice.q.length} ↗</button>`:''}${review?`<button onclick="resumeStudy('review')">Resume review · ${review.cursor}/${review.q.length} ↗</button>`:''}${RS()?'<button onclick="resume()">Continue earlier practice ↗</button>':''}${S.cfg.cramDict?'<button aria-label="Continue earlier Listen & Write" onclick="resumeCramDict()">Continue earlier Listen & Write ↗</button>':''}${S.cfg.cram&&S.cfg.cram.i<S.cfg.cram.q.length?'<button aria-label="Continue earlier unit review" onclick="resumeCram()">Continue earlier unit review ↗</button>':''}</div>
 <button class="study-help-entry" aria-label="Help" onclick="showHomeworkHelp()"><span aria-hidden="true">${writingBook()}</span><span><b>Help</b><small>Ideas for your homework</small></span><span aria-hidden="true">↗</span></button>
 <nav class="grove-quick-links" aria-label="Your collections"><button onclick="showGroveRewards()">Your grove ↗</button><button onclick="rewardCollection()">My badges ↗</button>${Number(GR())>=2?'<button aria-label="My progress" onclick="kidProgress()">My progress ↗</button>':''}</nav>
 ${groveGoalMarkup()}
 <details class="compact-help"><summary>More tools</summary><div class="study-more-tools"><button class="progress-link" onclick="qList()">All unit quizzes</button><button class="progress-link" onclick="catG=GR();cat()">All characters</button><button class="progress-link" onclick="zooScreen()">My Zoo</button></div></details>
 <div class="grove-section-heading"><h2>My characters</h2><span>${esc(GN[GR()])} · Any unit, any order</span></div>
 ${GR()==='K'?'<p class="reading-note grove-unit-help">Unit 1 teaches basic strokes. Characters start at Unit 2.</p>':''}
 <input id="srch" ${KG()?'hidden':''} type="search" placeholder="Search pinyin, like mai or chang" autocomplete="off" autocapitalize="off" aria-label="Search by pinyin" oninput="srch(this.value)"><div id="sres" class="zoo"></div>
 ${groveUnitControls()}<div class="sets" id="sets"></div>${wallet.legacyCredit?.amount?`<button class="grove-legacy-link" onclick="showGroveRewards()">🍊 ${wallet.legacyCredit.amount} oranges from earlier practice · Your original stars stay yours ↗</button>`:''}</div>`;
}
function groveActivityHeading(mode){
 const labels={trace:'Trace',listen:'Listen & Tap',flip:'Flip Cards',memory:'Draw from Memory',dictation:'Listen & Write'};
 return `<div class="grove-activity-heading"><span>${groveTree(mode==='dictation'?'writing':mode,2)}</span><div><p class="grove-eyebrow">A MOMENT TO GROW</p><h1>${labels[mode]}</h1></div></div>`;
}
function unitGroveGrowth(chars){
 const practiced=chars.filter(char=>(S.pts?.[char]||0)>0||Object.values(S.learning?.chars?.[char]?.skills||{}).some(r=>(r.attempts||0)>(r.skips||0))).length;
 const badges=chars.filter(char=>!!S.rewards?.characters?.[char]).length;
 return {practiced,badges,stage:!practiced?0:practiced<chars.length?1:badges<chars.length?2:3};
}
function setGroveView(view){S.cfg.groveView=view==='list'?'list':'trees';save();homeSets();}
function groveUnitControls(){return '<div class="grove-view" role="group" aria-label="Unit display"><button id="grove-view-trees" onclick="setGroveView(\'trees\')">🌳 Grove</button><button id="grove-view-list" onclick="setGroveView(\'list\')">☷ List</button></div><p class="reading-note">Every unit is yours to explore. Choose any tree; you can practice units in any order.</p>';}
function updateGroveView(){
 const el=$('sets'),trees=S.cfg.groveView!=='list';if(!el)return;
 el.classList.toggle('grove-trees',trees);el.classList.toggle('grove-sunrise',groveEquipped(S).sky==='sunrise');
 for(const [id,on]of [['grove-view-trees',trees],['grove-view-list',!trees]])$(id)?.setAttribute('aria-pressed',String(on));
}
function groveEquippedMarkup(){
 const equipped=groveEquipped(S);
 return `<div class="grove-equipped"><h2>In your grove</h2><p>Mix one decoration from each area. Changing your mind is free.</p>${Object.entries(GROVE_SLOTS).map(([slot,label])=>{const id=equipped[slot],item=GROVE_REWARD_CATALOG.find(r=>r.id===id),name=item?.name||(slot==='visitors'&&groveVisitorIcon()?groveVisitorIcon()+' Zoo friend':'Original');return `<div><span><small>${label}</small><b>${name}</b></span>${id?`<button data-grove-control="clear-${slot}" onclick="groveClear('${slot}')" aria-label="Put away ${label.toLowerCase()} decoration">Put away</button>`:'<span class="grove-original">Yours to decorate</span>'}</div>`}).join('')}</div>`;
}
function groveProjectMarkup(project){
 const wallet=groveWallet(S),built=wallet.projects?.[project.id],stage=built?.stage||0,next=project.stages[stage],goal=wallet.goal==='project:'+project.id;
 return `<article class="grove-project" data-project="${project.id}"><div class="grove-project-art"><svg viewBox="-10 -16 133 137" aria-hidden="true">${stage?groveProjectArt(project.id,stage):'<path d="M8 98H108M20 90V32L60 6L100 32V90" fill="none" stroke="var(--tree-ground)" stroke-width="2" stroke-dasharray="5 5"/>'}</svg></div><div class="grove-project-info"><h3>${project.name}</h3><small class="grove-project-total">🍊 ${project.stages.reduce((n,p)=>n+p.cost,0)} total · ${stage}/${project.stages.length} built</small><progress value="${stage}" max="${project.stages.length}" aria-label="${project.name} pieces built"></progress>${next?`<div class="grove-item-actions"><button class="btn" data-grove-control="build-${project.id}" onclick="groveBuild('${project.id}')" ${wallet.balance<next.cost?'disabled':''}>Build ${next.name} · 🍊 ${next.cost}</button><button class="grove-goal-button" data-grove-control="goal-project:${project.id}" onclick="grovePin(${goal?'null':`'project:${project.id}'`})" aria-label="${goal?'Clear this goal':'Make this my goal'}" aria-pressed="${goal}" title="${goal?'Clear this goal':'Make this my goal'}">${goal?'★':'☆'}</button></div>`:'<p class="grove-built-stamp">✦ Built by you!</p>'}<details class="grove-project-plan"><summary>Pieces &amp; prices</summary><p>${project.description}</p><ol>${project.stages.map((piece,i)=>`<li class="${i<stage?'is-built':''}"><span>${i<stage?'✓':i+1} ${piece.name}</span><small>🍊 ${piece.cost}</small></li>`).join('')}</ol></details>${stage?`<button class="grove-goal-button grove-project-visibility" data-grove-control="visible-${project.id}" onclick="groveProjectToggle('${project.id}')">${built.visible===false?'Show in my grove':'Put away for now'}</button>`:''}</div></article>`;
}
function groveCatalogMarkup(slot,label){
 const wallet=groveWallet(S),equipped=groveEquipped(S);
 return `<section class="grove-catalog-section" id="grove-catalog-${slot}"><h2 class="sr-only">${label} decorations</h2><div class="reward-grid grove-catalog-grid">${GROVE_REWARD_CATALOG.filter(r=>r.slot===slot).map(r=>{const owned=wallet.owned.includes(r.id),selected=equipped[slot]===r.id,goal=wallet.goal===r.id;return `<article class="reward-card" data-reward="${r.id}"><details class="grove-item-details"><summary aria-label="About ${r.name}"><span class="grove-item-icon" aria-hidden="true">${r.icon}</span><h3>${r.name}</h3><span class="grove-item-info" aria-hidden="true">ⓘ</span></summary><small>${r.description}</small></details><div class="grove-item-actions">${owned?`<button class="btn gray" data-grove-control="reward-${r.id}" onclick="${selected?`groveClear('${slot}')`:`groveChoose('${r.id}')`}" aria-pressed="${selected}">${selected?'Put away':'Use this'}</button>`:`<button class="btn" data-grove-control="reward-${r.id}" onclick="groveUnlock('${r.id}')" ${wallet.balance<r.cost?'disabled':''}>Unlock · 🍊 ${r.cost}</button><button class="grove-goal-button" data-grove-control="goal-${r.id}" onclick="grovePin(${goal?'null':`'${r.id}'`})" aria-label="${goal?'Clear this goal':'Make this my goal'}" aria-pressed="${goal}" title="${goal?'Clear this goal':'Make this my goal'}">${goal?'★':'☆'}</button>`}</div></article>`}).join('')}</div></section>`;
}
function groveCollectionsMarkup(){
 const wallet=groveWallet(S);
 return `<section class="grove-collections"><h2>Your collection stamps</h2><p class="reading-note">Collect all four decorations in an area to earn its stamp. Earned stamps stay yours.</p><div>${Object.entries(GROVE_SLOTS).map(([slot,name])=>{const done=wallet.collections?.[slot],count=GROVE_REWARD_CATALOG.filter(r=>r.slot===slot&&wallet.owned.includes(r.id)).length;return `<article class="${done?'is-earned':''}"><span aria-hidden="true">${done?'✦':'◇'}</span><b>${name}</b><small>${done?'Collected!':count+' / 4'}</small></article>`}).join('')}</div>${wallet.collections?.grove?'<p class="grove-built-stamp">✦ Grove curator · Your whole decoration collection is complete!</p>':''}</section>`;
}
const GROVE_REWARD_TABS={build:'Build',...GROVE_SLOTS,stamps:'Stamps'};
function setGroveRewardTab(tab){
 if(!Object.hasOwn(GROVE_REWARD_TABS,tab))return;
 S.cfg.groveRewardTab=tab;save();
 for(const button of A.querySelectorAll('[data-grove-tab]')){const selected=button.dataset.groveTab===tab;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}
 for(const panel of A.querySelectorAll('[data-grove-panel]'))panel.hidden=panel.dataset.grovePanel!==tab;
}
function groveShowGoal(){
 const goal=groveGoalStatus(S);if(goal){S.cfg.groveRewardTab=GROVE_REWARD_CATALOG.find(r=>r.id===goal.id)?.slot||'build';save();}showGroveRewards();
}
function showGroveRewards(message=''){
 const arrange=!!A.querySelector('.grove-arrange[open]');screen();$('gov')?.remove();SESS=null;CRAM=null;
 const wallet=groveWallet(S),friends=groveZooFriends(S,ANIMALS,MASTER),visitor=groveEquipped(S).visitors;
 const active=Object.hasOwn(GROVE_REWARD_TABS,S.cfg.groveRewardTab)?S.cfg.groveRewardTab:'build';
 const recent=wallet.transactions.slice().reverse().find(t=>!t.undone&&(t.type==='unlock'&&wallet.owned.includes(t.reward)||t.type==='build'&&wallet.projects?.[t.project]?.stage===t.stage));
 const panel=(id,content)=>`<section id="grove-panel-${id}" role="tabpanel" aria-labelledby="grove-tab-${id}" data-grove-panel="${id}" ${active===id?'':'hidden'}>${content}</section>`;
 A.innerHTML=`<div class="grove-reward-page"><div class="grove-compact-title"><h1>Your grove</h1><small>Grow it your way.</small></div><div class="grove-reward-tools" tabindex="-1"><b>🍊 ${wallet.balance} oranges</b>${recent?`<button id="grove-undo" data-grove-control="undo">Undo last ${recent.type==='build'?'piece':'unlock'} · refund 🍊 ${-recent.amount}</button>`:'<span>One orange per ribbon or sentence.</span>'}</div><p id="grove-reward-message" class="sr-only" role="status">${voiceEscape(message)}</p>
 <section class="grove-reward-workbench"><figure class="grove-reward-scene">${groveLandscape()}<figcaption>Your grove, your way.</figcaption></figure><div class="grove-workbench-controls">${groveGoalMarkup()||'<p class="reading-note">Pick a decoration or start a project. Earned rewards stay yours.</p>'}<details class="grove-arrange" ${arrange?'open':''}><summary>Arrange your grove</summary>${groveEquippedMarkup()}${groveGoalStatus(S)?'<button class="grove-goal-clear" data-grove-control="clear-goal" onclick="grovePin(null)">Clear goal</button>':''}<button class="btn gray" data-grove-control="original" onclick="groveChoose(null)">Use the original grove</button></details></div></section>
 <nav class="grove-catalog-nav" role="tablist" aria-label="Grove rewards">${Object.entries(GROVE_REWARD_TABS).map(([id,label])=>`<button role="tab" id="grove-tab-${id}" data-grove-tab="${id}" aria-controls="grove-panel-${id}" aria-selected="${id===active}" tabindex="${id===active?0:-1}" onclick="setGroveRewardTab('${id}')">${label}</button>`).join('')}</nav>
 ${panel('build',`<div class="grove-projects">${GROVE_PROJECT_CATALOG.map(groveProjectMarkup).join('')}</div>`)}
 ${Object.entries(GROVE_SLOTS).map(([slot,label])=>panel(slot,`${slot==='visitors'?`<section class="grove-zoo-visitors"><h2>Earned friends · free visits</h2><div>${friends.map((animal,i)=>`<button onclick="groveInvite(${i})" data-grove-control="invite-${i}" aria-label="Invite zoo friend ${i+1}" aria-pressed="${visitor==='zoo:'+i}"><span aria-hidden="true">${animal}</span><small>Friend ${i+1}</small></button>`).join('')||'<p>Your first earned zoo friend will appear here.</p>'}</div></section>`:''}${groveCatalogMarkup(slot,label)}`)).join('')}
 ${panel('stamps',`${groveCollectionsMarkup()}${wallet.writingSentences?`<p class="reading-note">${wallet.writingSentences} sentences celebrated · self-reported.</p>`:''}${wallet.legacyCredit?.stars?`<details class="legacy-credit-history"><summary>Earlier practice · 🍊 +${wallet.legacyCredit.amount}</summary><p>${wallet.legacyCredit.stars} original stars ÷ ${wallet.legacyCredit.rate} = ${Math.floor(wallet.legacyCredit.stars/wallet.legacyCredit.rate)} oranges, less ${wallet.legacyCredit.ribbonFruit} already credited from ribbons. Added once. Your stars and character progress stay yours.</p></details>`:''}${groveHistory(wallet)}`)}
 <details class="grove-reward-help"><summary>How oranges &amp; rewards work</summary><p>A practice ribbon grows one orange. A sentence you mark finished in Writing ideas grows ${REWARD_POLICY.fruitPerSentence}. Swapping owned decorations and inviting earned zoo friends are free. Decorations don’t change mastery. You keep your original ${S.stars} stars.</p></details><div class="grove-reward-footer"><button class="btn gray" onclick="rewardCollection()">My badges</button><button class="btn" onclick="home()">Back home</button></div></div>`;
 A.querySelector('[role="tablist"]').onkeydown=event=>{
  const tabs=[...A.querySelectorAll('[data-grove-tab]')],index=tabs.indexOf(event.target);if(index<0)return;
  const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;
  if(next<0)return;event.preventDefault();tabs[next].click();tabs[next].focus();
 };
 if(recent)$('grove-undo').onclick=()=>{if(undoGroveUnlock(S,recent.id))groveRewardUpdate('Undone. Your oranges are back.');};
}
function groveRewardUpdate(message){
 const y=scrollY,control=document.activeElement?.dataset.groveControl;
 save();showGroveRewards(message);groveActionNotice(message);
 requestAnimationFrame(()=>{
  window.scrollTo(0,y);if(!control)return;
  let target=A.querySelector(`[data-grove-control="${control}"]:not(:disabled)`);
  if(!target&&control.startsWith('build-'))target=A.querySelector(`[data-grove-control="visible-${control.slice(6)}"]`);
  if(!target&&control.startsWith('goal-'))target=A.querySelector('.grove-goal-clear');
  (target||A.querySelector('.grove-reward-tools'))?.focus({preventScroll:true});
 });
}
let groveActionNoticeTimer;
function groveActionNotice(message){
 let notice=$('grove-action-notice');if(!notice){notice=document.createElement('div');notice.id='grove-action-notice';notice.setAttribute('role','status');document.body.append(notice);}
 notice.textContent=message;notice.hidden=false;clearTimeout(groveActionNoticeTimer);
 groveActionNoticeTimer=setTimeout(()=>notice.hidden=true,3500);
}
function groveUnlock(id){
 const before=Object.keys(groveWallet(S).collections||{}).length;
 if(redeemGroveReward(S,id)){const stamp=Object.keys(groveWallet(S).collections||{}).length>before;groveRewardUpdate(stamp?'Unlocked! You earned a collection stamp!':'Unlocked and in your grove! You can undo it below.');}
 else showGroveRewards('Keep practicing for more oranges.');
}
function groveChoose(id){if(selectGroveDecoration(S,id)){if(id===null)for(const project of Object.values(groveWallet(S).projects||{}))project.visible=false;groveRewardUpdate('Your grove is ready.');}}
function groveClear(slot){if(clearGroveSlot(S,slot))groveRewardUpdate('Put away. You can use it again any time.');}
function groveBuild(id){if(buildGroveProject(S,id))groveRewardUpdate('A new piece for your grove!');}
function groveProjectToggle(id){const project=groveWallet(S).projects?.[id];if(project&&setGroveProjectVisible(S,id,project.visible===false))groveRewardUpdate('Your grove is ready.');}
function grovePin(id){if(pinGroveGoal(S,id))groveRewardUpdate(id?'Your next goal is pinned.':'Goal cleared. Choose a new one whenever you like.');}
function groveInvite(index){if(selectGroveZooVisitor(S,index,ANIMALS,MASTER))groveRewardUpdate('Your zoo friend is visiting!');}
function groveHistory(wallet){
 const label=tx=>tx.type==='unlock'?'Unlocked '+(GROVE_REWARD_CATALOG.find(r=>r.id===tx.reward)?.name||'decoration'):tx.type==='build'?'Built '+tx.piece:tx.type==='refund'?'Refund · '+(tx.piece||GROVE_REWARD_CATALOG.find(r=>r.id===tx.reward)?.name||'decoration'):tx.source==='legacy-stars'?'Earlier star credit':tx.source==='writing-sentence'?'Sentence celebrated':'Practice ribbons';
 return `<details class="grove-history"><summary>Orange history</summary><ul>${wallet.transactions.slice(-12).reverse().map(tx=>`<li><span>${voiceEscape(label(tx))}<small>${new Date(tx.at).toLocaleDateString()}</small></span><b>${tx.amount>0?'+':''}${Number(tx.amount)}</b></li>`).join('')||'<li>Your first orange is waiting to grow.</li>'}</ul></details>`;
}
