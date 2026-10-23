const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const load = () => require('../vocabulary.js');
const pack = () => read('content/elementary-vocabulary.json');
const plain = value => JSON.parse(JSON.stringify(value));

test('the focused suggestion pack preserves exact licensed lexical evidence and pending review', () => {
  assert.ok(fs.existsSync(path.join(root, 'content/elementary-vocabulary.json')), 'the sourced pack exists');
  const data = pack(), bank = read('vendor/cc-cedict/words.json');
  const source = read('vendor/cc-cedict/SOURCE.json');
  assert.ok(data.entries.length >= 20 && data.entries.length <= 40);
  assert.equal(new Set(data.entries.map(item => item.id)).size, data.entries.length);
  assert.equal(data.license, 'CC-BY-SA-4.0');
  assert.equal(data.source.upstreamSha256, source.sha256);
  assert.equal(data.source.transformedSha256, require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root, 'vendor/cc-cedict/words.json'))).digest('hex'));
  for (const item of data.entries) {
    assert.match(item.id, /^mg-vocab-\d{4}$/);
    assert.ok(bank.entries.some(row => JSON.stringify(row) === JSON.stringify(item.source.row)), item.word);
    assert.equal(item.word, item.source.row[0]);
    assert.equal(item.pinyin, item.source.row[2]);
    assert.ok(item.source.row[3].includes(item.meaning), item.word);
    assert.equal(item.source.license, 'CC-BY-SA-4.0');
    assert.equal(item.status.lexical, 'pinned-dictionary-match');
    assert.equal(item.status.instructional, 'pending-fluent-review');
    assert.equal(item.status.use, 'lookup-only');
    assert.ok(item.curriculum.length > 0);
    assert.equal(item.writingIdea.status, 'agent-authored-draft');
    assert.equal(item.writingIdea.graded, false);
    assert.equal(item.writingIdea.review, 'pending-fluent-review');
  }
});

test('suggestions retain lexical tones, traditional aliases and feedback identity', () => {
  assert.ok(fs.existsSync(path.join(root, 'vocabulary.js')), 'the pure lookup exists');
  const api = load(), data = pack();
  const thanks = api.examples('謝')[0];
  assert.equal(thanks.word, '谢谢');
  assert.equal(thanks.pinyin, 'xie4 xie5');
  assert.equal(api.examples('律')[0].pinyin, 'gui1 lu:4');
  assert.equal(api.examples('转')[0].pinyin, 'zhuan3 wan1');
  assert.equal(thanks.packId, data.id);
  assert.equal(thanks.packVersion, data.version);
  assert.match(thanks.id, /^mg-vocab-\d{4}$/);
  assert.deepEqual(api.examples('謝'), api.examples('谢'));
  assert.equal(api.examples('万').length, 3);
  assert.equal(api.examples('万', {limit: 1}).length, 1);
  assert.deepEqual(api.examples('万', {limit: 0}), []);
  assert.deepEqual(api.examples('没有这个词'), []);
  assert.deepEqual(api.examples(null), []);
});

test('explicit browser binding uses no DOM or network and keeps missing packs neutral', () => {
  assert.ok(fs.existsSync(path.join(root, 'vocabulary.js')), 'the pure lookup exists');
  const context = vm.createContext({fetch() {throw Error('network must not run');}});
  vm.runInContext(fs.readFileSync(path.join(root, 'vocabulary.js'), 'utf8'), context);
  assert.deepEqual(plain(context.GroveVocabulary.examples('改')), []);
  const query = context.GroveVocabulary.bind(pack());
  assert.equal(query('改')[0].word, '改正');
  assert.equal(query('億')[0].word, '亿万');
  assert.deepEqual(plain(query('您')), []);
  assert.deepEqual(plain(context.groveVocabularyExamples('改', {pack: pack()})), plain(query('改')));
});

test('suggestions cannot narrow dictionary alternatives or grade unknown expressions', () => {
  assert.ok(fs.existsSync(path.join(root, 'vocabulary.js')), 'the pure lookup exists');
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(root, 'words.js'), 'utf8'), context);
  const bank = read('vendor/cc-cedict/words.json'), index = context.createWordIndex(bank);
  const api = load();
  for (const word of ['学校', '學校', '学生', '小学']) {
    assert.equal(context.checkWordAnswer('学', word, index).status, 'recognized', word);
  }
  const before = context.checkWordAnswer('学', '学甲乙丙', index);
  api.examples('学');
  assert.deepEqual(plain(context.checkWordAnswer('学', '学甲乙丙', index)), plain(before));
  assert.equal(before.status, 'unverified');
  assert.equal(context.checkWordAnswer('您', '您好', index).status, 'unverified');
});
