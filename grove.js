// Grove presentation only. Reward rules/catalog/state live in rewards.js.
const GROVE_MODE_COLORS={trace:'#E8B582',listen:'#A6BC80',flip:'#D5B6E4',memory:'#9EBBA4',unit:'#BACB94',writing:'#E8B582'};
function groveTree(mode='unit',growth=3){
 const skin=groveWallet(S).selected,color=skin==='violet-leaves'?'#AD96DC':GROVE_MODE_COLORS[mode]||GROVE_MODE_COLORS.unit;
 if(growth===0)return '<svg viewBox="0 0 90 90" aria-hidden="true"><path d="M14 73H76" stroke="#9C8063" stroke-width="3" stroke-linecap="round"/><path d="M45 72V52" stroke="#514438" stroke-width="5"/><path d="M45 57C26 59 26 38 26 38C44 36 48 47 45 57ZM46 52C45 36 65 30 65 30C70 46 60 56 46 52Z" fill="'+color+'"/></svg>';
 return '<svg viewBox="0 0 90 90" aria-hidden="true"><path d="M18 78H72" stroke="#9C8063" stroke-width="3" stroke-linecap="round"/><path d="M46 76V34M46 59L27 45M46 49L63 33" fill="none" stroke="#514438" stroke-width="5" stroke-linecap="round"/><path d="M24 51C4 49 10 26 20 24C12 7 40 3 46 16C65 3 82 21 73 34C89 47 67 64 55 54C43 67 28 61 24 51Z" fill="'+color+'"/><path d="M46 75V42M46 60L29 48M46 52L62 38" fill="none" stroke="#514438" stroke-width="4" stroke-linecap="round"/>'+(growth>1?'<circle cx="25" cy="34" r="7" fill="#F97316"/><circle cx="62" cy="31" r="7" fill="#F97316"/>':'')+(growth>2?'<circle cx="61" cy="51" r="7" fill="#F97316"/>':'')+'</svg>';
}
function unitGroveGrowth(chars){
 const practiced=chars.filter(char=>Object.values(S.learning?.chars?.[char]?.skills||{}).some(r=>(r.attempts||0)>(r.skips||0))).length;
 const badges=chars.filter(char=>!!S.rewards?.characters?.[char]).length;
 return {practiced,badges,stage:!practiced?0:practiced<chars.length?1:badges<chars.length?2:3};
}
function setGroveView(view){S.cfg.groveView=view==='list'?'list':'trees';save();homeSets();}
function groveUnitControls(){return '<div class="grove-view" role="group" aria-label="Unit display"><button id="grove-view-trees" onclick="setGroveView(\'trees\')">🌳 Grove</button><button id="grove-view-list" onclick="setGroveView(\'list\')">☷ List</button></div><p class="reading-note">Every unit is yours to explore. Choose any tree; you can practice units in any order.</p>';}
function updateGroveView(){
 const el=$('sets'),trees=S.cfg.groveView!=='list';if(!el)return;
 el.classList.toggle('grove-trees',trees);el.classList.toggle('grove-sunrise',groveWallet(S).selected==='sunrise');
 for(const [id,on]of [['grove-view-trees',trees],['grove-view-list',!trees]])$(id)?.setAttribute('aria-pressed',String(on));
}
function showGroveRewards(message=''){
 screen();$('gov')?.remove();SESS=null;CRAM=null;
 const wallet=groveWallet(S),recent=wallet.transactions.slice().reverse().find(t=>t.type==='unlock'&&!t.undone&&wallet.owned.includes(t.reward));
 A.innerHTML=`<h1>Your grove</h1><p class="grove-fruit-total">🍊 ${wallet.balance} oranges</p><p class="reading-note">Every practice ribbon grows an orange. Each sentence you mark finished in Writing ideas grows ${REWARD_POLICY.fruitPerSentence}. Your earlier ribbons already count.</p><div class="grove-preview ${wallet.selected==='sunrise'?'grove-sunrise':''}">${wallet.selected==='butterfly'?'<span class="grove-butterfly" aria-hidden="true">🦋</span>':''}${groveTree('unit',3)}</div><p id="grove-reward-message" role="status">${voiceEscape(message)}</p>${wallet.writingSentences?`<p class="reading-note">${wallet.writingSentences} sentence${wallet.writingSentences===1?'':'s'} celebrated · self-reported writing</p>`:''}<h2>Make it your own</h2><div class="reward-grid">${GROVE_REWARD_CATALOG.map(r=>{const owned=wallet.owned.includes(r.id),selected=wallet.selected===r.id;return `<div class="reward-card"><span aria-hidden="true">${r.icon}</span><b style="font-size:22px">${r.name}</b><small>${r.description}</small>${owned?`<button class="btn gray" onclick="groveChoose('${r.id}')" ${selected?'disabled':''}>${selected?'Using this':'Use this'}</button>`:`<button class="btn" onclick="groveUnlock('${r.id}')" ${wallet.balance<r.cost?'disabled':''}>Unlock · 🍊 ${r.cost}</button>`}</div>`}).join('')}</div><p class="reading-note">Decorations change how your grove looks. They don’t change your learning progress.</p><button class="btn gray" onclick="groveChoose(null)">Use the original grove</button>${recent?`<button class="btn gray" id="grove-undo">Undo last unlock · refund 🍊 ${-recent.amount}</button>`:''}<button class="btn gray" onclick="rewardCollection()">My badges</button><button class="btn" onclick="home()">Back home</button>`;
 if(recent)$('grove-undo').onclick=()=>{if(undoGroveUnlock(S,recent.id)){save();showGroveRewards('Unlock undone. Your oranges are back.')}};
}
function groveUnlock(id){if(redeemGroveReward(S,id)){save();showGroveRewards('Unlocked! You can undo this below.')}else showGroveRewards('Keep practicing for more oranges.');}
function groveChoose(id){if(selectGroveDecoration(S,id)){save();showGroveRewards('Your grove is ready.')}}
