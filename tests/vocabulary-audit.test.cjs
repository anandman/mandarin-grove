const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const load = () => require('../scripts/audit-vocabulary.cjs');
const fixtures = () => ({
  allowSubset: true,
  pack: read('content/elementary-vocabulary.json'),
  dictionary: read('vendor/cc-cedict/words.json'),
  curriculum: {'2': [[18, '改让百千万亿']], '3': [[20, '父母敢错便乐继续']]},
  catalogs: [
    {id: 'current', cards: [{c: '百', w: '百万', wp: 'bǎi wàn'}]},
    {id: 'replacement', cards: [{c: '百', w: '', wp: ''}]}
  ],
  promptWords: ['父母']
});

test('audit measures each supplied catalog and keeps draft prompts distinct', () => {
  assert.ok(fs.existsSync(path.join(root, 'scripts/audit-vocabulary.cjs')), 'the audit exists');
  const report = load().auditVocabulary(fixtures());
  const before = report.catalogs.find(row => row.id === 'current').grades['2'];
  const after = report.catalogs.find(row => row.id === 'replacement').grades['2'];
  assert.equal(before.characters, 6);
  assert.equal(before.helpExamples.baseline, 2);
  assert.equal(before.helpExamples.withPack, 6);
  assert.equal(before.helpExamples.added, 4);
  assert.equal(after.helpExamples.baseline, 0);
  assert.equal(after.helpExamples.withPack, 6);
  assert.equal(after.helpExamples.added, 6);
  assert.equal(after.writingIdeas.baseline, 0);
  assert.equal(after.writingIdeas.withDrafts, 6);
  assert.equal(after.units[0].unit, 18);
  assert.equal(report.catalogs[1].grades['3'].writingIdeas.baseline, 2);
  assert.equal(report.catalogs[1].grades['3'].writingIdeas.withDrafts, 4);
  assert.equal(report.provenance.dictionaryMatched, report.provenance.entries);
  assert.equal(report.provenance.instructionallyReviewed, 0);
  assert.deepEqual(report.provenance.issues, []);
});

test('audit flags reading evidence mismatches rather than silently certifying a pack', () => {
  assert.ok(fs.existsSync(path.join(root, 'scripts/audit-vocabulary.cjs')), 'the audit exists');
  const input = fixtures();
  input.pack.entries[0].pinyin = 'gai4 zheng4';
  const report = load().auditVocabulary(input);
  assert.ok(report.provenance.issues.some(issue => issue.id === input.pack.entries[0].id && issue.code === 'reading-mismatch'));
  assert.equal(report.provenance.instructionallyReviewed, 0);
});

test('CLI reproduces supplied JSON snapshot coverage without executing application startup', () => {
  assert.ok(fs.existsSync(path.join(root, 'scripts/audit-vocabulary.cjs')), 'the audit exists');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grove-vocabulary-audit-'));
  try {
    const input = fixtures();
    const write = (name, value) => {const file = path.join(dir, name + '.json');fs.writeFileSync(file, JSON.stringify(value));return file;};
    const current = write('current', input.catalogs[0].cards);
    const replacement = write('replacement', {cards: input.catalogs[1].cards});
    const args = ['scripts/audit-vocabulary.cjs', '--subset', '--catalog', 'current=' + current, '--catalog', 'replacement=' + replacement,
      '--curriculum', write('curriculum', input.curriculum), '--writing-ideas', write('ideas', input.promptWords)];
    const result = spawnSync(process.execPath, args, {cwd: root, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.catalogs[0].grades['2'].helpExamples.added, 4);
    assert.equal(report.catalogs[1].grades['2'].helpExamples.added, 6);
    assert.equal(report.inputs.catalogs.length, 2);
    assert.match(report.inputs.pack.sha256, /^[a-f0-9]{64}$/);
  } finally {fs.rmSync(dir, {recursive: true, force: true});}
});

test('audit detects a changed dictionary pin even when every selected row still matches', () => {
  const input = fixtures();
  const report = load().auditVocabulary({...input, dictionarySha256: '0'.repeat(64)});
  assert.equal(report.provenance.dictionaryMatched, input.pack.entries.length);
  assert.equal(report.provenance.dictionaryFilePinMatches, false);
  assert.ok(report.provenance.issues.some(issue => issue.code === 'dictionary-file-pin-mismatch'));
});


test('default CLI audits the actual independent curriculum with no legacy runtime extraction',()=>{
 const result=spawnSync(process.execPath,['scripts/audit-vocabulary.cjs'],{cwd:root,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const report=JSON.parse(result.stdout);assert.equal(report.inputs.catalogs[0].path,'content/curriculum.json');
 assert.equal(report.catalogs[0].grades['2'].characters,151);assert.equal(report.provenance.dictionaryFilePinMatches,true);
});


test('full audit rejects nonexistent grade/unit tags while explicit subset auditing stays scoped',()=>{
 for(const invalid of [{grade:'2',unit:999},{grade:'99',unit:18}]){
  const input=fixtures();input.allowSubset=false;input.curriculum=read('tests/fixtures/better-immersion-k5.json');Object.assign(input.pack.entries[0].curriculum[0],invalid);
  const report=load().auditVocabulary(input);assert.ok(report.provenance.issues.some(issue=>issue.id===input.pack.entries[0].id&&issue.code==='curriculum-reference-missing'));
  assert.ok(!load().auditVocabulary({...input,allowSubset:true}).provenance.issues.some(issue=>issue.code==='curriculum-reference-missing'));
 }
});
