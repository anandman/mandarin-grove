// Unit review uses a temporary pool; ordinary practice selection and resumable sessions stay intact.
let CRAM = null;
const cramSelection = {};
function storedCramSelections(){
  const stored=PR.cur?JSON.parse(localStorage.getItem('zh_p_'+PR.cur)||'null'):null;
  return stored?.cfg?.cramUnits || S.cfg.cramUnits || {};
}
function saveCramSelection(){
  S.cfg.cramUnits={...storedCramSelections(),[GR()]:[...(cramSelection[GR()]||[])]};
  save(true);
}

function mixedCramModes(){return Number(GR())>=2?['listen','trace','flip','memory','dictation']:['listen','trace','flip','memory'];}
const CRAM_MODES = [
  ['trace','Trace','Follow the strokes'], ['listen','Listen & Tap','Hear it, find it'],
  ['flip','Flip Cards','Review every selected character'], ['memory','Draw from Memory','Write it yourself'],
  ['dictation','Listen & Write','Write the character and its pinyin']
];
function cramChoices() {
  return HSETS().o.map(h => ({
    id:h.a ? h.id : h.supplemental ? 'set:'+h.t.split(' ').pop() : Number(h.t.split(' ').pop()),
    grade:h.g, added:!!h.a, supplemental:!!h.supplemental, label:h.t, chars:h.c
  }));
}
function selectedCramCards() {
  const selected=cramSelection[GR()] || new Set();
  const chars=new Set(cramChoices().filter(h=>selected.has(h.id)).flatMap(h=>h.chars));
  const byCharacter=new Map(ALL.map(c=>[c.c,c]));
  return [...chars].map(c=>byCharacter.get(c)).filter(Boolean);
}
function practiceCards() { return CRAM ? CRAM.pool : CARDS; }
function showCram() {
  CRAM = null; SESS = null; lq = []; mq = []; screen();
  const grade = GR(), units = cramChoices();
  const available = new Set(units.map(h=>h.id));
  S.cfg.cramUnits=storedCramSelections();
  const stored = S.cfg.cramUnits?.[grade];
  cramSelection[grade] = new Set((Array.isArray(stored) ? stored : []).filter(id=>available.has(id)));
  const groups = new Map();
  for (const unit of units) {
    const key=unit.grade+':'+unit.added+':'+unit.supplemental;
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(unit);
  }
  A.innerHTML = `<section class="cram-page"><div class="grove-compact-title"><h1>Unit review</h1><small>${GN[grade]} · Mix ${mixedCramModes().length} modes</small></div>
    <div class="cram-startbar"><p id="cram-count" aria-live="polite"></p><button class="btn" data-cram-mode="mixed" onclick="startCram('mixed')">Start mixed review ▶</button></div>
    <div class="cram-picker-heading"><h2>Choose units</h2><div class="cram-actions"><button class="btn gray" onclick="selectCramUnits(true)">All units / sets</button><button class="btn gray" onclick="selectCramUnits(false)">Clear</button></div></div>
    <div class="cram-picker" tabindex="0" role="region" aria-label="Units and sets">${[...groups.values()].map(group=>`<section class="cram-group"><h2>${GN[group[0].grade]||'Other'} · ${group[0].supplemental?'Supplemental practice':group[0].added?'Added units':'Units'}</h2><div class="cram-units">${group.map(({id:n,label,chars,grade:g})=>`<label class="cram-unit"><input type="checkbox" data-unit="${n}" aria-label="${GN[g]||'Other'} · ${label}" ${cramSelection[grade].has(n)?'checked':''}><span><b>${label}</b><small>${[...chars].join(' ')}</small></span></label>`).join('')}</div></section>`).join('')}</div>
    <details class="compact-help"><summary>How unit review works</summary><p class="reading-note">Up to 30 random questions balanced across ${mixedCramModes().length===5?'five':'four'} modes. Questions sample your selection, including characters that are not due yet. Answers update the same learning progress as daily practice and save after each answer. Choose any units from My Characters, including added grades. Your normal practice selection stays the same.${grade==='K'?' Unit 1 teaches basic strokes and has no character quiz.':''}</p></details>
    <details class="compact-help"><summary>Review in just one mode</summary><div class="modes cram-modes">${CRAM_MODES.map(([mode,name,description])=>`<button data-cram-mode="${mode}" onclick="startCram('${mode}')"><span>${name}<small>${description}</small></span></button>`).join('')}</div></details></section>`;
  A.querySelectorAll('[data-unit]').forEach(input => input.onchange = () => {
    const selected = cramSelection[grade], id=units.find(h=>String(h.id)===input.dataset.unit).id; input.checked ? selected.add(id) : selected.delete(id); saveCramSelection(); updateCramCount();
  });
  updateCramCount();
}
function selectCramUnits(all) {
  cramSelection[GR()] = new Set(all ? cramChoices().map(h=>h.id) : []);
  saveCramSelection();
  A.querySelectorAll('[data-unit]').forEach(input => input.checked = all);
  updateCramCount();
}
function updateCramCount() {
  const selected = [...cramSelection[GR()]], pool = selectedCramCards();
  $('cram-count').textContent = `${selected.length} units / sets · ${pool.length} characters · ${Math.min(30,pool.length*mixedCramModes().length)} activities`;
  A.querySelectorAll('[data-cram-mode]').forEach(button => button.disabled = !pool.length);
}
function startCram(mode = 'mixed', repeat = false) {
  if (mode !== 'mixed' && !CRAM_MODES.some(([m])=>m===mode)) return;
  const pool = repeat && CRAM ? CRAM.pool : selectedCramCards();
  if (!pool.length) return;
  stopSpeech(); lq = []; mq = []; TH = []; TF = [];
  CRAM = { mode, pool }; SESS = null;
  if (mode === 'dictation') { dictStart(pool.map(c=>c.c).join('')); return; }
  const modes = mode === 'mixed' ? mixedCramModes() : [mode];
  const q = cramQueue(pool,modes,30,shuffle);
  SESS = {cram:true, q, i:0, t:'Unit review · '+(mode==='mixed'?'all '+modes.length+' modes':CRAM_MODES.find(([m])=>m===mode)[1]), pool};
  nextItem();
}
