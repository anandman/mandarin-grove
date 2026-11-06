/* Viewport geometry only: never reload a screen, writer, draft or saved state. */
const GroveViewport = (() => {
 let pending = 0;
 const steppers = new Set();
 const settingsViews = new WeakMap();
 const find = id => document.getElementById(id);
 function schedule() {
  if (pending) return;
  pending = requestAnimationFrame(() => {
   pending = 0;
   const viewport = window.visualViewport;
   const unzoomed = !viewport || Math.abs(viewport.scale - 1) < 0.01;
   const height = unzoomed && viewport ? Math.min(innerHeight, viewport.height) : innerHeight;
   const editing = document.activeElement?.matches('input:not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]');
   document.body.classList.toggle('compact-input', !!editing && height < 550);
   const report = find('report-problem'), footer = document.querySelector('body > footer'), reportHeader = document.querySelector('body > header');
   const reportInHeader = height < 500 && innerWidth >= 700;
   const reportHost = reportInHeader ? reportHeader : footer;
   if (report && reportHost && report.parentElement !== reportHost) reportHost.append(report);
   if (report) { report.classList.toggle('compact-report', reportInHeader); report.textContent = reportInHeader ? '?' : 'Report a problem';report.setAttribute('aria-label', 'Report a problem'); }
   const top = unzoomed && viewport ? Math.max(0, viewport.offsetTop) : 0;
   const values = {
    '--app-viewport-height': height + 'px',
    '--app-viewport-top': top + 'px',
    '--app-viewport-bottom': Math.max(0, innerHeight - top - height) + 'px'
   };
   for (const [name, value] of Object.entries(values)) {
    if (document.documentElement.style.getPropertyValue(name) !== value) document.documentElement.style.setProperty(name, value);
   }
   const header = document.querySelector('body > header');
   const shell = [header, find('reward-strip'), find('speech-status')].reduce((sum, node) => sum + (node?.getBoundingClientRect().height || 0), 0);
   document.documentElement.style.setProperty('--app-navigation-top', shell + 'px');
   for (const stepper of steppers) {
    if (!stepper.root.isConnected) steppers.delete(stepper);
    else stepper.update();
   }
   updateTop();
  });
 }
 function setScreen(kind = 'content', activity = '') {
  document.body.dataset.layout = kind;
  if (activity) document.body.dataset.activity = activity;
  else delete document.body.dataset.activity;
  schedule();
 }
 function region(className) {
  const node = document.createElement('div');
  node.className = className;
  return node;
 }
 function arrangeActivity(mode, root) {
  setScreen('task', mode);
  const children = [...root.children];
  const frame = document.createElement('section');
  frame.className = 'activity-frame';
  frame.dataset.mode = mode;
  const heading = region('activity-frame-heading');
  const information = region('activity-frame-information');
  const workspace = region('activity-frame-workspace');
  const feedback = region('activity-frame-feedback');
  const actions = region('activity-frame-actions');
  const hasWorkspace = children.some(node => node.matches('#hw, #cd, .choices, .dictation-workspace'));
  if (!hasWorkspace) workspace.classList.add('activity-result');
  for (const node of children) {
   if (node.matches('.grove-activity-heading, .sess, .study-sessionbar')) heading.append(node);
   else if (node.matches('#hw, #cd, .choices, .dictation-workspace')) workspace.append(node);
   else if (node.matches('.msg')) feedback.append(node);
   else if (node.matches('button, #flip-rating')) actions.append(node);
   else if (hasWorkspace) information.append(node);
   else workspace.append(node);
  }
  const result = workspace.querySelector('.dictation-workspace:has(#cy)');
  if (result) {
   result.classList.add('dictation-comparison');
   for (const button of result.querySelectorAll('#cy, #cn')) actions.append(button);
   result.lastElementChild?.classList.add('dictation-comparison-information');
  }
  const bar = heading.querySelector('.study-sessionbar'), deferred = actions.querySelector('.study-not-learned');
  if (bar && deferred) bar.append(deferred);
  const prompt = information.querySelector('.dictation-prompt > div');
  if (prompt) {
   for (const note of [...information.querySelectorAll(':scope > .reading-note')]) prompt.append(note);
   prompt.tabIndex = 0;prompt.setAttribute('aria-label', 'Listen and write instructions');
  }
  const help = information.querySelector('#writing-help-note');
  if (help) {
   const details = document.createElement('details'), toggle = document.createElement('summary'), copy = region('activity-prompt-copy');
   details.className = 'activity-help';toggle.textContent = 'ⓘ';toggle.setAttribute('aria-label', 'About watching strokes');
   details.append(toggle, help);
   for (const node of [...information.children]) if (node !== help) copy.append(node);
   if (mode === 'memory') {
    // The reading and meaning identify the question; instructions/examples
    // belong in the existing help disclosure instead of clipping that cue.
    const cue = region('activity-memory-cue'), explanation = region('activity-help-information');
    for (const node of [...copy.children]) {
     if (node.matches('.pin, .mean')) { node.tabIndex = 0; cue.append(node); }
     else explanation.append(node);
    }
    explanation.append(help); details.append(explanation);
    information.append(cue, details);
   } else information.append(copy, details);
  }
  if (!information.children.length) information.hidden = true;
  else { information.tabIndex = 0; information.setAttribute('aria-label', 'Activity information'); }
  if (!feedback.children.length) feedback.hidden = true;
  if (!actions.children.length) actions.hidden = true;
  frame.append(heading, information, workspace, feedback, actions);
  root.append(frame);
  const dictation = workspace.querySelector('.dictation-workspace:has(#dc)');
  if (dictation) steps(dictation, [...dictation.children], ['Write', 'Pinyin']);
  schedule();
 }
 // Hide/show existing panes only. Inputs, ink, handlers and ownership remain
 // exactly where the activity created them; moving steps never checks/saves.
 function steps(root, panes, labels) {
  let index = 0;
  const navigation = region('compact-step-navigation');
  navigation.setAttribute('aria-label', 'Steps');
  const back = document.createElement('button'), next = document.createElement('button');
  const status = document.createElement('span');
  for (const button of [back, next]) { button.type = 'button'; button.className = 'btn gray'; }
  back.textContent = 'Back';
  status.setAttribute('role', 'status');
  navigation.append(back, status, next);
  root.append(navigation);
  const update = () => {
   const compact = root.clientWidth < 940 || innerHeight < 760;
   const focused = panes.findIndex(pane => pane.contains(document.activeElement));
   if (focused >= 0 && !root.classList.contains('compact-steps')) index = focused;
   root.classList.toggle('compact-steps', compact);
   panes.forEach((pane, i) => { pane.hidden = compact && i !== index; });
   navigation.hidden = !compact;
   back.disabled = index === 0;
   next.hidden = index === panes.length - 1;
   next.textContent = 'Next: ' + labels[index + 1];
   status.textContent = `${index + 1} of ${panes.length} · ${labels[index]}`;
  };
  const move = change => {
   index = Math.max(0, Math.min(panes.length - 1, index + change));
   update();
   const target = panes[index].querySelector('textarea, input, canvas, h2, label');
   if (target) { if (!target.matches('textarea, input')) target.tabIndex = -1; target.focus({preventScroll: true}); }
  };
  back.onclick = () => move(-1); next.onclick = () => move(1);
  steppers.add({root, panes, update, reveal(element) {const i = panes.findIndex(pane => pane.contains(element));if (i >= 0) {index = i;update();}}}); update(); schedule();
 }
 function reveal(element) { for (const stepper of steppers) if (stepper.root.isConnected) stepper.reveal(element); }
 function summary(root) {
  setScreen('task', 'summary');
  steps(root.querySelector('.summary-steps'), [...root.querySelectorAll('.summary-steps > .summary-field')], ['Main idea', 'Key details', 'My summary']);
 }
 function studyControls(root) {
  const bar = root.querySelector('.study-sessionbar'), deferred = root.querySelector('.study-not-learned');
  if (bar && deferred) bar.append(deferred);
  schedule();
 }
 function words(root, study) {
  if (study) {setScreen('task', 'words');studyControls(root);}
 }
 function onboarding(root) {
  setScreen('task', 'onboarding');
  const identity = region('onboarding-pane'), grade = region('onboarding-pane');
  const children = [...root.children];
  for (const node of children.slice(2, 7)) identity.append(node);
  for (const node of children.slice(7)) grade.append(node);
  const work = region('onboarding-steps');work.append(identity, grade);root.append(work);
  steps(work, [identity, grade], ['Name & animal', 'Grade']);
 }
 function settings(dialog, destinations, selected) {
  const content = region('settings-content'), footer = region('settings-actions');
  const about = dialog.querySelector('#about-settings');
  // Preserve the existing dashboard/feedback/version/recovery information in
  // About rather than leaving it between the header and the selected pane.
  if (about) for (const node of [...dialog.children]) if (!node.matches('header, section')) about.append(node);
  const backup = dialog.querySelector('#backup-settings');
  if (backup) {
   const information = region('backup-information'), actions = region('backup-actions'), restore = backup.querySelector('#grx'), status = backup.querySelector('#backup-status');
   for (const id of ['gcopy', 'gdownload', 'gload', 'grest']) {const button = backup.querySelector('#' + id);if (button) actions.append(button);}
   for (const node of [...backup.children]) if (node !== restore && node !== status) information.append(node);
   backup.append(information, actions);if (status) backup.append(status);if (restore) backup.append(restore);
  }
  for (const section of [...dialog.querySelectorAll(':scope > section')]) content.append(section);
  const save = dialog.querySelector('#gsave');if (save) footer.append(save);
  dialog.classList.add('settings-frame');dialog.append(content, footer);
  settingsViews.set(dialog, {content, footer, destinations});
  if (!settingsSection(dialog, selected)) settingsSection(dialog, 'device');
 }
 function settingsSection(dialog, key) {
  const view = settingsViews.get(dialog);if (!view) return false;
  const id = view.destinations[key];
  if (!view.content.querySelector('#' + id)) return false;
  for (const section of view.content.children) section.hidden = section.id !== id;
  view.footer.hidden = key !== 'child';view.content.scrollTop = 0;
  for (const button of dialog.querySelectorAll('[data-settings-section]')) button.setAttribute('aria-pressed', String(button.dataset.settingsSection === key));
  schedule();return true;
 }
 function feedbackAction(button, root) {
  const actions = root.querySelector('.activity-frame-actions');
  if (actions) {actions.hidden = false;actions.append(button);schedule();}
 }
 function recovery(root) {
  setScreen('recovery');
  const frame = region('progress-recovery'), information = region('recovery-information'), actions = region('recovery-actions');
  const children = [...root.children];
  for (const node of children) {
   if (node.matches('h1')) frame.append(node);
   else if (node.matches('button')) actions.append(node);
   else if (node.id !== 'recovery-file-status') information.append(node);
  }
  frame.append(information, actions);
  const status = root.querySelector('#recovery-file-status');if (status) frame.append(status);
  root.replaceChildren(frame);const nav = find('page-navigation');if (nav) nav.hidden = true;
  schedule();
 }
 function feedback(dialog) {
  const heading = region('feedback-frame-heading'), information = region('feedback-frame-information'), actions = region('feedback-frame-actions');
  for (const node of [...dialog.children]) {
   if (node.matches('form, h2')) heading.append(node);
   else if (node.matches('#feedback-send, #feedback-save, #feedback-status, #feedback-pending')) actions.append(node);
   else information.append(node);
  }
  dialog.classList.add('feedback-frame');dialog.append(heading, information, actions);schedule();
 }
 function updateTop() {
  find('totop')?.classList.toggle('show', (find('app')?.scrollTop || window.scrollY) > 300);
 }
 function scrollToTop() {
  find('app')?.scrollTo({top: 0, behavior: 'smooth'});
  window.scrollTo({top: 0, behavior: 'smooth'});
 }
 function start() {
  const main = find('app');
  main?.addEventListener('scroll', updateTop, {passive: true});
  if (find('totop')) find('totop').onclick = scrollToTop;
  window.addEventListener('resize', schedule, {passive: true});
  window.visualViewport?.addEventListener('resize', schedule, {passive: true});
  window.visualViewport?.addEventListener('scroll', schedule, {passive: true});
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', schedule);
  if (typeof ResizeObserver !== 'undefined') {
   const observer = new ResizeObserver(schedule);
   for (const node of [document.querySelector('body > header'), find('reward-strip'), find('page-navigation'), find('speech-status'), document.querySelector('body > footer')]) if (node) observer.observe(node);
  }
  schedule();
 }
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
 else start();
 return {setScreen, arrangeActivity, summary, onboarding, settings, settingsSection, studyControls, words, reveal, feedbackAction, recovery, feedback, scrollToTop};
})();
