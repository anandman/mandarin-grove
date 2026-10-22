const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox']
  });
  try {
    const page = await browser.newPage({ viewport: { width: 820, height: 1060 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:4181');

    async function startRound(mode) {
      return page.evaluate(mode => {
        PR = { cur: 'study-attempt', list: [{ id: 'study-attempt', name: 'Learner', gr: '2', av: '🐼' }] };
        savePR();
        S = blank();
        S.stars = 11;
        S.pts = { 狗: 2 };
        S.cfg.set = ['狗'];
        save();
        setCards();
        window.say = () => {};
        home();
        const card = ALL.find(card => card.c === '狗');
        startStudyRound('review', {
          units: [], chars: ['狗'], modes: [mode], limit: 5
        }, [card], [[mode, card]]);
        return { stars: S.stars, pts: { ...S.pts } };
      }, mode);
    }

    const dictationRewards = await startRound('dictation');
    await page.locator('#dchk').click();
    assert.match(await page.locator('#app').innerText(), /❌/);
    assert.equal(await page.evaluate(() => S.cfg.studyRounds['2'].review.attempts['dictation:狗'].pinyinMiss), true);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.evaluate(() => resumeStudy('review'));

    for (const letter of 'gou') await page.locator(`[data-t="${letter}"]`).first().click();
    await page.locator('[data-tn="3"]').click();
    await page.locator('#dchk').click();
    assert.match(await page.locator('#app').innerText(), /gǒu ✅/);
    // Observe the real transition boundary; no production test hook is needed.
    await page.evaluate(() => {
      const advance = nextItem;
      nextItem = () => {
        window.attemptBeforeAdvance = JSON.parse(JSON.stringify({
          history: S.studyHistory,
          stars: S.stars,
          pts: S.pts
        }));
        nextItem = advance;
        return advance();
      };
    });
    await page.locator('#cy').click();

    const dictation = await page.evaluate(() => ({
      history: S.studyHistory,
      pinyin: skillState(S, '狗', 'pinyin'),
      writing: skillState(S, '狗', 'writing'),
      stars: S.stars,
      pts: S.pts,
      beforeAdvance: window.attemptBeforeAdvance,
      savedHistory: JSON.parse(localStorage.getItem('zh_p_study-attempt')).studyHistory
    }));
    assert.equal(dictation.beforeAdvance.history.length, 1, 'Final dictation result is archived before advancing');
    assert.equal(dictation.savedHistory.length, 1, 'Final history is already persisted');
    assert.equal(dictation.history.length, 1);
    assert.equal(dictation.history[0].score.percent, 0);
    assert.equal(dictation.history[0].results['dictation:狗'].outcome, 'miss');
    assert.equal(dictation.pinyin.attempts, 1);
    assert.equal(dictation.pinyin.correct, 0);
    assert.equal(dictation.pinyin.misses, 1);
    assert.equal(dictation.writing.attempts, 1);
    assert.equal(dictation.writing.correct, 1);
    assert.deepEqual({ stars: dictation.stars, pts: dictation.pts }, dictationRewards,
      'Correcting pinyin after Pause cannot earn the independent-success reward');
    assert.deepEqual({ stars: dictation.beforeAdvance.stars, pts: dictation.beforeAdvance.pts }, dictationRewards);
    assert.equal(await page.getByRole('heading', { name: 'Round finished!', exact: true }).count(), 1);
    assert.match(await page.locator('.study-finish').innerText(), /0 \/ 1/);

    // Capture Hanzi Writer's real completion callback to supply deterministic strokes.
    await page.evaluate(() => {
      const create = HanziWriter.create;
      HanziWriter.create = function (...args) {
        const instance = create.apply(this, args);
        const quiz = instance.quiz;
        instance.quiz = function (options) {
          window.attemptMemoryQuiz = options;
          return quiz.call(this, options);
        };
        return instance;
      };
    });
    const memoryRewards = await startRound('memory');
    await page.locator('#pk').click();
    assert.equal(await page.evaluate(() => S.cfg.studyRounds['2'].review.attempts['memory:狗'].help), true);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.evaluate(() => resumeStudy('review'));
    await page.evaluate(() => window.attemptMemoryQuiz.onComplete({ totalMistakes: 0 }));

    const memory = await page.evaluate(() => ({
      history: S.studyHistory,
      skill: skillState(S, '狗', 'memory'),
      stars: S.stars,
      pts: S.pts,
      message: document.getElementById('m').textContent,
      currentIndex: SESS.currentIndex,
      savedHistory: JSON.parse(localStorage.getItem('zh_p_study-attempt')).studyHistory
    }));
    assert.equal(memory.currentIndex, 0, 'The final memory question is still displayed before Next');
    assert.equal(memory.history.length, 1, 'Final memory result is archived before Next or Pause');
    assert.equal(memory.savedHistory.length, 1, 'Final memory history is already persisted');
    assert.equal(memory.history[0].score.percent, 0);
    assert.equal(memory.history[0].results['memory:狗'].outcome, 'assisted');
    assert.equal(memory.skill.attempts, 1);
    assert.equal(memory.skill.assisted, 1);
    assert.equal(memory.skill.correct, 0);
    assert.equal(memory.message, 'Got it! Keep practicing 👍');
    assert.deepEqual({ stars: memory.stars, pts: memory.pts }, memoryRewards,
      'Peeking before Pause cannot earn the independent-success reward');
    const historyBeforePause = JSON.stringify(memory.history);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    assert.equal(await page.getByRole('heading', { name: 'Round finished!', exact: true }).count(), 1);
    assert.match(await page.locator('.study-finish').innerText(), /0 \/ 1/);
    assert.equal(await page.evaluate(() => JSON.stringify(S.studyHistory)), historyBeforePause,
      'Opening the final summary neither duplicates nor changes first-attempt history');

    assert.deepEqual(errors, []);
    console.log('PASS: bad pinyin and Memory Peek survive Pause; scores, evidence, messages and rewards agree; final history is saved before advancing.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
