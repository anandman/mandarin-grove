// Cram uses a temporary pool; ordinary practice selection and resumable sessions stay intact.
let CRAM = null;
const cramSelection = {};
function saveCramSelection(){
  (S.cfg.cramUnits ||= {})[GR()] = [...(cramSelection[GR()] || [])];
  save();
}
function mixedCramModes(){return Number(GR())>=2?['listen','trace','flip','memory','dictation']:['listen','trace','flip','memory'];}
const CRAM_MODES = [
  ['trace','Trace','Follow the strokes'], ['listen','Listen & Tap','Hear it, find it'],
  ['flip','Flip Cards','Review every selected character'], ['memory','Draw from Memory','Write it yourself'],
  ['dictation','Hear, Write & Pinyin','Write the character and its pinyin']
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
  const stored = S.cfg.cramUnits?.[grade];
  cramSelection[grade] = new Set((Array.isArray(stored) ? stored : []).filter(id=>available.has(id)));
  saveCramSelection();
  const groups = new Map();
  for (const unit of units) {
    const key=unit.grade+':'+unit.added+':'+unit.supplemental;
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(unit);
  }
  A.innerHTML = `<h1>Cram mode</h1><p class="mean">${GN[grade]} · Choose units or sets from My Characters, across grades.</p>
    <p class="reading-note">Up to 30 randomly selected questions, balanced across all ${mixedCramModes().length===5?'five':'four'} modes. Progress saves after each answer. Your normal practice selection stays the same.</p>
    ${grade==='K'?'<p class="reading-note">Starter Unit 1 teaches basic strokes and has no character quiz.</p>':''}
    <div class="cram-actions"><button class="btn" onclick="selectCramUnits(true)">All units / sets</button><button class="btn gray" onclick="selectCramUnits(false)">Clear</button></div>
    ${[...groups.values()].map(group=>`<section class="cram-group"><h2>${GN[group[0].grade]||'Other'} · ${group[0].supplemental?'Supplemental practice':group[0].added?'Added units':'Units'}</h2><div class="cram-units">${group.map(({id:n,label,chars,grade:g})=>`<label class="cram-unit"><input type="checkbox" data-unit="${n}" aria-label="${GN[g]||'Other'} · ${label}" ${cramSelection[grade].has(n)?'checked':''}><span><b>${label}</b><small>${[...chars].join(' ')}</small></span></label>`).join('')}</div></section>`).join('')}
    <p id="cram-count" class="mean" aria-live="polite"></p>
    <button class="today" data-cram-mode="mixed" onclick="startCram('mixed')"><span><b>Start all ${mixedCramModes().length===5?'five':'four'} modes</b><small>All ${mixedCramModes().length===5?'five':'four'} modes mixed question by question</small></span><span class="go">▶ Start</span></button>
    <details><summary class="reading-note">Practice just one mode or take a pinyin quiz</summary>
    <div class="modes cram-modes">${CRAM_MODES.map(([mode,name,description])=>`<button data-cram-mode="${mode}" onclick="startCram('${mode}')"><span>${name}<small>${description}</small></span></button>`).join('')}</div></details>`;
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
  SESS = {cram:true, q, i:0, t:'Cram · '+(mode==='mixed'?'all '+modes.length+' modes':CRAM_MODES.find(([m])=>m===mode)[1]), pool};
  nextItem();
}
