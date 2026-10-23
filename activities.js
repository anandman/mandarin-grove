/* Independent web activity views. Learning, scheduling and rewards remain shared services. */
var writer = null;
var TH = [], TF = [], TLK = 0;
var lq = [], mq = [];
var DQ = null, DQL = null;

const ActivityUI = (() => {
  const requests = new Map();
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
  const find = id => document.getElementById(id);
  const button = (label, id, extra = 'gray') => `<button type="button" class="btn ${extra}" id="${id}">${label}</button>`;
  const on = (id, fn) => find(id)?.addEventListener('click', fn);
  const current = (token, node) => NAV === token && node.isConnected;
  const guard = (token, node, fn) => (...args) => { if (current(token, node)) return fn(...args); };
  function speak(card) { say(card.c); }
  function card(preferred, mode) {
    return preferred?.c ? preferred : reviewPick(S, practiceCards(), mode);
  }
  function render(mode, content, session = true) {
    screen();
    A.innerHTML = groveActivityHeading(mode) + (session ? sessBar() : '') + content;
    return { token: NAV, node: A.firstElementChild };
  }
  function loadStrokes(char) {
    if (typeof STROKES !== 'undefined' && STROKES[char]) return Promise.resolve(STROKES[char]);
    if (!requests.has(char)) {
      requests.set(char, fetch('strokes/' + encodeURIComponent(char) + '.json')
        .then(response => { if (!response.ok) throw Error('Stroke data unavailable'); return response.json(); })
        .then(data => { if (typeof STROKES !== 'undefined') STROKES[char] = data; return data; })
        .catch(error => { requests.delete(char); throw error; }));
    }
    return requests.get(char);
  }
  function makeWriter(c, outline, ready) {
    const box = find('hw');
    if (!box) return null;
    writer?.cancelQuiz?.();
    box.innerHTML = '';
    const token = NAV, width = box.clientWidth || 300;
    const style = getComputedStyle(box);
    const color = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
    const instance = WritingSurface.create(box, c.c, {
      width, height: width, padding: 22, showCharacter: false, showOutline: !!outline,
      strokeColor: color('--paper-ink', '#242B24'), outlineColor: color('--paper-outline', '#857E70'),
      drawingColor: color('--paper-ink', '#242B24'), highlightColor: color('--ac', '#F57727'),
      charDataLoader: (char, complete, fail) => loadStrokes(char).then(complete, error => { fail?.(error); }),
      onLoadCharDataSuccess: guard(token, box, data => ready?.(data)),
      onLoadCharDataError: guard(token, box, () => {
        const message = find('m');
        if (message) message.textContent = 'Writing guide unavailable. Try again or skip this character.';
      })
    });
    writer = instance;
    return instance;
  }
  function next(fn) { go(fn); }
  function success(c, outcome, stars = 1) {
    if (!finishReview(outcome)) return false;
    if (outcome === 'correct') win(c, stars);
    return true;
  }
  function message(text, good = false) {
    const element = find('m');
    if (element) { element.textContent = text; element.style.color = good ? 'var(--success)' : 'var(--ac-ink)'; }
  }
  function nextButton(id = 'sk') {
    const element = find(id);
    if (element) { element.textContent = 'Next ▶'; element.classList.add('pulse'); }
  }
  function persistDictation() {
    if (!DQ || DQ.session || !CRAM) return;
    if (DQ.i >= DQ.q.length) delete S.cfg.cramDict;
    else S.cfg.cramDict = { ...DQ, q: DQ.q.map(c => c.c), pool: CRAM.pool.map(c => c.c) };
    save();
  }
  function draw(canvas) {
    const context = canvas.getContext('2d');
    let previous = null;
    canvas.style.touchAction = 'none';
    const point = event => {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * canvas.width / rect.width,
        y: (event.clientY - rect.top) * canvas.height / rect.height };
    };
    const stop = () => { previous = null; };
    canvas.addEventListener('pointerdown', event => {
      event.preventDefault(); previous = point(event); canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (!previous) return;
      event.preventDefault(); const end = point(event);
      // Store dark canonical pixels; CSS maps both this canvas and its preview in dark mode.
      context.strokeStyle = '#242B24';
      context.lineWidth = 6; context.lineCap = 'round'; context.lineJoin = 'round';
      context.beginPath(); context.moveTo(previous.x, previous.y); context.lineTo(end.x, end.y); context.stroke(); previous = end;
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, stop);
    return () => { context.clearRect(0, 0, canvas.width, canvas.height); stop(); };
  }
  return { escape, find, button, on, guard, current, speak, card, render, loadStrokes, makeWriter, next, success, message, nextButton, persistDictation, draw };
})();

function wordLine(c, hidden = false) {
  if (!c.w) return '';
  const text = String(c.w).split('|').map(part => hidden
    ? part.split(c.c).map(ActivityUI.escape).join('<span class="blank" aria-label="missing character"></span>')
    : ActivityUI.escape(part)).join(' / ');
  return `<div class="mean">${text} <span style="color:var(--ac-ink)">${ActivityUI.escape((c.wp || '').replaceAll('|', ' / '))}</span></div>`;
}
function mkWriter(c, outline, onDone) { return ActivityUI.makeWriter(c, outline, onDone); }
function pyBase(p) { return pinyinBase(p); }
function pyTone(p) { return pinyinTone(p); }
function pyMark(base, tone) {
  const text = String(base).replace(/v/g, 'ü');
  if (!tone) return text;
  let position = text.indexOf('a');
  if (position < 0) position = text.indexOf('e');
  if (position < 0 && text.includes('ou')) position = text.indexOf('o');
  if (position < 0) for (let i = text.length - 1; i >= 0; i--) if ('iouü'.includes(text[i])) { position = i; break; }
  if (position < 0) return text;
  const mark = ['\u0304','\u0301','\u030c','\u0300'][tone - 1];
  return mark ? (text.slice(0, position + 1) + mark + text.slice(position + 1)).normalize('NFC') : text;
}

function trNav(direction, index) {
  if (TLK) return;
  if (SESS) { if (direction > 0) go(() => trace(index)); return; }
  if (direction < 0) {
    if (!TH.length) return;
    TF.push(index); trace(TH.pop());
  } else {
    skipReview(); TH.push(index);
    trace(TF.length ? TF.pop() : practiceCards().indexOf(reviewPick(S, practiceCards(), 'trace')));
  }
}
function trace(index = 0) {
  const cards = practiceCards();
  if (!cards.length) return;
  index = ((index % cards.length) + cards.length) % cards.length;
  const c = cards[index], ui = ActivityUI;
  const view = ui.render('trace', `<div class="pin">${ui.escape(c.p)}</div><div class="mean">${ui.escape(c.m)}</div>${wordLine(c)}
    <div id="hw" role="group" aria-label="Trace ${ui.escape(c.c)}"></div><p class="msg" id="m" role="status"></p>
    ${ui.button('◀ Back', 'prev')}${ui.button('🔊 Hear again', 'trp')}${ui.button('Watch strokes', 'watch')}${ui.button('Next ▶', 'sk')}`);
  beginReview(c, 'trace');
  TLK = 1; after(700, () => { TLK = 0; });
  ui.on('trp', () => ui.speak(c));
  ui.on('prev', () => trNav(-1, index));
  if (SESS || !TH.length) ui.find('prev').disabled = true;
  ui.on('sk', () => trNav(1, index));
  const instance = mkWriter(c, true);
  let complete = false, helped = !!(SESS?.study && studyAttemptInfo()?.help);
  const quiz = () => instance.quiz({
    showHintAfterMisses: 1, leniency: 1.2,
    onMistake: ui.guard(view.token, view.node, () => { if (SESS?.study) studyAttempt('stroke'); ui.message('Follow the highlighted stroke'); }),
    onCorrectStroke: ui.guard(view.token, view.node, () => ui.message('')),
    onComplete: ui.guard(view.token, view.node, summary => {
      if (complete) return; complete = true;
      const outcome = traceOutcome(summary.totalMistakes, helped);
      const first = SESS?.study ? studyOutcome(outcome) : outcome;
      if (finishReview(first)) win(c);
      ui.message('Great tracing! 🌟', true); instance.showCharacter(); ui.nextButton(); ui.speak(c);
    })
  });
  quiz();
  ui.on('watch', () => {
    helped = true; if (SESS?.study) studyAttempt('help');
    instance.cancelQuiz(); instance.animateCharacter({onComplete: ui.guard(view.token, view.node, () => { if (!complete) quiz(); })});
  });
  ui.speak(c);
}

function listen(preferred) {
  const ui = ActivityUI, c = ui.card(preferred, 'listen');
  if (!c) return;
  const distinct = pool => pool.filter(other => other.c !== c.c && !samePronunciation(c, other));
  const selected = distinct(practiceCards());
  const alternatives = shuffle(selected.length ? selected : distinct(ALL)).slice(0, 3);
  const choices = shuffle([c, ...alternatives]);
  const view = ui.render('listen', `<div class="listen-prompt"><h2>Tap what you hear</h2><button id="rp" type="button" aria-label="Hear again">🔊</button></div>
    <div class="choices">${choices.map(choice => `<button type="button" data-c="${ui.escape(choice.c)}" aria-label="${ui.escape(choice.c)}">${ui.escape(choice.c)}</button>`).join('')}</div>
    <p class="msg" id="m" role="status"></p>${ui.button('Skip ▶', 'sk')}`);
  beginReview(c, 'listen');
  let missed = !!(SESS?.study && studyAttemptInfo()?.miss), done = false;
  ui.on('rp', () => ui.speak(c)); ui.on('sk', () => ui.next(listen));
  A.querySelectorAll('[data-c]').forEach(option => option.addEventListener('click', ui.guard(view.token, view.node, () => {
    if (done || option.disabled) return;
    if (option.dataset.c !== c.c) {
      missed = true; ACTIVE_REVIEW.missed = true;
      if (SESS?.study) studyAttempt('miss');
      option.classList.add('no'); option.disabled = true; ui.message('Try again'); return;
    }
    done = true; option.classList.add('ok');
    A.querySelectorAll('[data-c]').forEach(choice => { choice.disabled = true; });
    const outcome = SESS?.study ? studyOutcome(missed ? 'miss' : 'correct') : missed ? 'miss' : 'correct';
    ui.success(c, outcome); ui.message(missed ? 'Got it! Keep practicing 👍' : 'You got it! 🎉', !missed);
    ui.nextButton(); after(1000, () => ui.next(listen));
  })));
  ui.speak(c);
}

function dayNum() { return Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000); }
function nextCard() { return reviewPick(S, practiceCards(), 'flip'); }
function flip(preferred) {
  const ui = ActivityUI, c = ui.card(preferred, 'flip');
  if (!c) return;
  const view = ui.render('flip', `<p class="reading-note">Can you remember the sound and meaning?</p>
    <button type="button" class="card" id="cd" aria-label="Reveal card" style="color:var(--tx);border:0;font:inherit"><span class="big">${ui.escape(c.c)}</span><small>Tap to flip</small></button>
    <div id="flip-rating" hidden>${ui.button('Not yet', 'no', 'r')}${ui.button('I knew it', 'yes', 'g')}</div>${ui.button('Skip ▶', 'sk')}`);
  beginReview(c, 'flip');
  let revealed = false;
  ui.on('cd', () => {
    if (revealed) return; revealed = true;
    ui.find('cd').innerHTML = `<span class="big" style="font-size:100px">${ui.escape(c.c)}</span><span class="pin">${ui.escape(c.p)}</span><span class="mean">${ui.escape(c.m)}</span>${wordLine(c)}`;
    ui.find('flip-rating').hidden = false; ui.speak(c);
  });
  ui.on('sk', () => ui.next(flip));
  for (const [id, outcome] of [['yes','correct'],['no','miss']]) ui.on(id, ui.guard(view.token, view.node, () => {
    if (!revealed || !ui.success(c, outcome)) return;
    if (!CRAM) {
      const level = outcome === 'correct' ? Math.min((S.box[c.c] || 0) + 1, 4) : 0;
      S.box[c.c] = level; S.due[c.c] = dayNum() + [0,1,2,4,7][level]; save();
    }
    ui.next(flip);
  }));
}

function memory(preferred) {
  const ui = ActivityUI, c = ui.card(preferred, 'memory');
  if (!c) return;
  const view = ui.render('memory', `<h2>Write this from memory</h2><div class="pin">${ui.escape(c.p)}</div><div class="mean">${ui.escape(c.m)}</div>${wordLine(c, true)}
    <div id="hw" role="group" aria-label="Write the character from memory"></div><p class="msg" id="m" role="status"></p>${ui.button('🔊 Hear again', 'mrp')}${ui.button('Peek', 'pk')}${ui.button('Skip ▶', 'sk')}`);
  beginReview(c, 'memory');
  let helped = !!(SESS?.study && studyAttemptInfo()?.help), complete = false;
  const instance = mkWriter(c, false);
  ui.on('mrp', () => ui.speak(c));
  ui.on('pk', () => {
    if (complete) return;
    helped = true; if (SESS?.study) studyAttempt('help');
    instance.showOutline(); after(1500, () => instance.hideOutline());
  });
  ui.on('sk', () => ui.next(memory));
  instance.quiz({
    showHintAfterMisses: 3, leniency: 1.2,
    onMistake: ui.guard(view.token, view.node, () => { if (SESS?.study) studyAttempt('stroke'); ui.message('Hmm, not that stroke'); }),
    onCorrectStroke: ui.guard(view.token, view.node, () => ui.message('')),
    onComplete: ui.guard(view.token, view.node, summary => {
      if (complete) return; complete = true;
      const outcome = helped || summary.totalMistakes > 2 ? 'assisted' : 'correct';
      const first = SESS?.study ? studyOutcome(outcome) : outcome;
      ui.success(c, first, 2); instance.showCharacter(); ui.find('pk').disabled = true;
      ui.message(first === 'correct' ? 'You remembered it! 🎉' : 'Got it! Keep practicing 👍', first === 'correct');
      ui.nextButton(); ui.speak(c);
    })
  });
  ui.speak(c);
}

function dictQuestion(c) { DQ = { session: true, bad: 0, q: [c], i: 0, score: 0, n: 0 }; dictItem(); }
function dictStart(chars) {
  SESS = null;
  if (chars !== undefined) DQL = chars;
  const wanted = new Set(Array.isArray(DQL) ? DQL.map(c => c.c || c) : [...(DQL ?? S.cfg.quiz ?? '')]);
  let queue = shuffle(ALL.filter(c => wanted.has(c.c)));
  if (CRAM) queue = queue.slice(0,30);
  else queue.sort((a,b) => Math.min(reviewPriority(S,a.c,'pinyin'),reviewPriority(S,a.c,'writing')) - Math.min(reviewPriority(S,b.c,'pinyin'),reviewPriority(S,b.c,'writing')));
  DQ = { bad:0, q:queue, i:0, score:0, n:0 }; dictItem();
}
function dictItem() {
  if (!DQ) return;
  const ui = ActivityUI, round = DQ;
  ui.persistDictation();
  if (round.i >= round.q.length) {
    ui.render('dictation', `<div class="big">🎉</div><h1>Quiz done!</h1><p class="mean">${round.score} of ${round.n} answers right.</p>${ui.button('Again', 'dict-again', '')}${ui.button('Home', 'dict-home')}${CRAM ? ui.button('Choose units / mode', 'dict-units') : ''}`, false);
    if (!round.bad && round.q.length) award('pq');
    ui.on('dict-again', () => dictStart()); ui.on('dict-home', home); ui.on('dict-units', showCram); return;
  }
  const c = round.q[round.i];
  // Study's dispatcher inserts its own session bar once the question is ready.
  const view = ui.render('dictation', `<div class="dictation-prompt">${ui.button('🔊', 'drp', '')}<div><h2>Listen, then write and build the pinyin</h2><p class="mean" id="dictation-clue">Meaning: ${ui.escape(c.m)}</p></div></div>
    <div class="dictation-workspace"><section class="dictation-writing"><div class="dictation-paper"><canvas id="dc" width="600" height="600" aria-label="Write the character here" style="width:100%;height:100%;display:block"></canvas></div>${ui.button('Clear writing', 'dclr')}</section>
    <section class="dictation-pinyin"><div class="dictation-pinyin-heading"><h2>Pinyin</h2><output id="pyout" aria-label="Your pinyin">&nbsp;</output></div><div id="tiles"></div><div class="dictation-tones" role="group" aria-label="Tone">${[1,2,3,4,0].map(tone=>`<button class="btn gray" type="button" data-tn="${tone}" aria-label="${tone ? 'Tone '+tone : 'Neutral tone'}">${tone ? ['','ā','á','ǎ','à'][tone] : 'neutral'}</button>`).join('')}</div>${ui.button('Delete letter', 'py-delete')}${ui.button('Check', 'dchk', '')}</section></div>`, !SESS?.study);
  feedbackQuestion = {card:c, mode:'dictation'}; renderRewards();
  let letters = '', tone = 0, locked = false;
  const requiredLetters = pinyinLetters(c);
  const extras = shuffle('abcdefghijklmnopqrstuvwxyzv'.split('').filter(letter => !requiredLetters.includes(letter))).slice(0,4);
  const lettersAvailable = shuffle(requiredLetters.concat(extras));
  ui.find('tiles').innerHTML = lettersAvailable.map(letter=>`<button type="button" class="btn gray" data-t="${letter}" aria-label="Letter ${letter === 'v' ? 'ü' : letter}">${letter === 'v' ? 'ü' : letter}</button>`).join('');
  const selected = [];
  const refresh = () => {
    ui.find('pyout').textContent = letters ? pyMark(letters, tone) : '\u00a0';
    A.querySelectorAll('[data-tn]').forEach(button => { button.setAttribute('aria-pressed', String(Number(button.dataset.tn) === tone)); button.style.background = Number(button.dataset.tn) === tone ? 'var(--ac-soft)' : ''; });
  };
  A.querySelectorAll('[data-t]').forEach(button => button.addEventListener('click', () => {
    if (locked) return;
    letters += button.dataset.t; selected.push(button); button.disabled = true; refresh();
  }));
  A.querySelectorAll('[data-tn]').forEach(button => button.addEventListener('click', () => { if (!locked) { tone = Number(button.dataset.tn); refresh(); } }));
  ui.on('py-delete', () => { if (!locked) { letters = letters.slice(0,-1); const button = selected.pop(); if (button) button.disabled = false; refresh(); } });
  const canvas = ui.find('dc'), clear = ui.draw(canvas);
  ui.on('dclr', clear); ui.on('drp', () => ui.speak(c));
  ui.on('dchk', ui.guard(view.token, view.node, () => {
    if (locked) return; locked = true;
    const right = pinyinMatches(c, letters, tone);
    if (!right && round.session && SESS?.study) studyAttempt('pinyinMiss');
    const firstPinyin = right && !(round.session && SESS?.study && studyAttemptInfo()?.pinyinMiss);
    const picture = canvas.toDataURL();
    A.innerHTML = groveActivityHeading('dictation') + sessBar() + `<div class="pin">${ui.escape(c.p)} ${right ? '✅' : '❌'}</div><p class="mean">Your pinyin: ${ui.escape(letters ? pyMark(letters,tone) : '—')}</p><div class="dictation-workspace"><div class="dictation-paper"><img alt="Your handwriting" src="${picture}" style="width:100%;height:100%"></div><div><div class="big">${ui.escape(c.c)}</div><p class="mean">${ui.escape(c.m)}</p><p>Did you write the character correctly?</p>${ui.button('Yes, I got it', 'cy', 'g')}${ui.button('Not yet', 'cn', 'r')}</div></div>`;
    let rated = false;
    const rate = chOk => {
      if (rated || NAV !== view.token || DQ !== round) return; rated = true;
      const pyOutcome = firstPinyin ? 'correct' : 'miss', writingOutcome = chOk ? 'correct' : 'miss';
      recordSkill(S,c.c,'pinyin',pyOutcome); recordSkill(S,c.c,'writing',writingOutcome);
      const outcome = firstPinyin && chOk ? 'correct' : 'miss';
      if (round.session && SESS?.study) recordStudyAnswer({evidence:[{skill:'pinyin',method:'checked',outcome:pyOutcome},{skill:'writing',method:'self-rated',outcome:writingOutcome}]},outcome);
      if (outcome === 'correct') win(c,2);
      round.score += Number(right) + Number(chOk); round.n += 2; round.bad += Number(!firstPinyin || !chOk); round.i++;
      if (round.session && SESS && !SESS.study) { const key=SESS.cram?'cram':'rs'; if(S.cfg[key]) S.cfg[key].i=SESS.i; }
      ui.persistDictation(); save();
      if (round.session) nextItem(); else dictItem();
    };
    ui.on('cy', () => rate(true)); ui.on('cn', () => rate(false));
  }));
  refresh(); ui.speak(c);
}
