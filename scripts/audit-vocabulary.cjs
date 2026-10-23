#!/usr/bin/env node
// Structural content audit only: no app startup, child state, network or semantic grading.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const isExample = word => typeof word === 'string' && /^\p{Script=Han}{2,8}$/u.test(word);
const unique = values => [...new Set(values)];
const charactersOf = words => new Set(words.flatMap(word => [...word]));
const activeEntries = pack => (pack.entries || []).filter(item => item.status?.use === 'lookup-only' && item.status?.instructional !== 'quarantined');

function auditVocabulary({pack, curriculum, dictionary, catalogs, promptWords = [], dictionarySha256 = null, allowSubset = false}) {
 const entries = pack.entries || [], dictionaryRows = new Set((dictionary.entries || []).map(row => JSON.stringify(row)));
 const issues = [], seen = new Set();
 const dictionaryFilePinMatches = dictionarySha256 === null ? null : dictionarySha256 === pack.source?.transformedSha256;
 if (dictionaryFilePinMatches === false) issues.push({id: null, word: null, code: 'dictionary-file-pin-mismatch'});
 let dictionaryMatched = 0;
 for (const item of entries) {
  const issue = code => issues.push({id: item.id || null, word: item.word || null, code});
  if (!item.id || seen.has(item.id)) issue('missing-or-duplicate-id');
  seen.add(item.id);
  const row = item.source?.row;
  if (!Array.isArray(row) || !dictionaryRows.has(JSON.stringify(row))) issue('source-row-missing');
  else dictionaryMatched++;
  if (item.word !== row?.[0]) issue('headword-mismatch');
  if (item.pinyin !== row?.[2]) issue('reading-mismatch');
  if (!item.meaning || !row?.[3]?.includes(item.meaning)) issue('sense-evidence-missing');
  if (item.source?.license !== 'CC-BY-SA-4.0' || !item.source?.id) issue('source-metadata-missing');
  if (!item.status?.lexical || !item.status?.instructional || !item.status?.use) issue('review-status-missing');
  if (!Array.isArray(item.curriculum) || !item.curriculum.length) issue('curriculum-tags-missing');
  const aliasRows = [row, ...(item.source?.aliasRows || [])].filter(Array.isArray);
  for (const alias of item.aliases || []) {
   if (!aliasRows.some(evidence => evidence[0] === item.word && evidence[1] === alias
    && evidence[2] === item.pinyin && dictionaryRows.has(JSON.stringify(evidence)))) issue('alias-evidence-missing');
  }
  for (const tag of item.curriculum || []) {
   const unit = curriculum[tag.grade]?.find(([number]) => number === tag.unit);
   // Missing references are errors unless a caller explicitly selected a subset.
   if (!unit && !allowSubset) issue('curriculum-reference-missing');
   if (unit && (!tag.characters?.length || tag.characters.some(character => !unit[1].includes(character) || !item.word.includes(character)))) issue('curriculum-tag-mismatch');
  }
  if (item.writingIdea && (item.writingIdea.graded !== false || !item.writingIdea.status || !item.writingIdea.review || !item.writingIdea.id)) issue('writing-idea-status-missing');
 }
 const active = activeEntries(pack), packChars = charactersOf(active.map(item => item.word).filter(isExample));
 const draftChars = charactersOf(active.filter(item => item.writingIdea?.graded === false && item.writingIdea?.text).map(item => item.word));
 const existingIdeaChars = charactersOf(promptWords);
 function catalogWords(cards) {
  return cards.flatMap(card => [
   ...(typeof card.w === 'string' ? card.w.split('|') : []),
   ...(Array.isArray(card.examples) ? card.examples.map(example => typeof example === 'string' ? example : example.word || example.text) : [])
  ]).filter(isExample);
 }
 const results = catalogs.map(({id, cards}) => {
  const available = new Set(cards.map(card => card.c || card.character));
  const baselineChars = charactersOf([...catalogWords(cards), ...promptWords.filter(isExample)]);
  function coverage(text) {
   const chars = unique([...text]);
   const baseline = chars.filter(ch => baselineChars.has(ch));
   const withPack = chars.filter(ch => baselineChars.has(ch) || packChars.has(ch));
   const ideas = chars.filter(ch => existingIdeaChars.has(ch));
   const withDrafts = chars.filter(ch => existingIdeaChars.has(ch) || draftChars.has(ch));
   return {
    characters: chars.length, catalogCharacters: chars.filter(ch => available.has(ch)).length,
    helpExamples: {baseline: baseline.length, withPack: withPack.length, added: withPack.length - baseline.length,
     missingBefore: chars.filter(ch => !baselineChars.has(ch)).join(''), missingAfter: chars.filter(ch => !baselineChars.has(ch) && !packChars.has(ch)).join('')},
    writingIdeas: {baseline: ideas.length, withDrafts: withDrafts.length, addedDrafts: withDrafts.length - ideas.length,
     missingBefore: chars.filter(ch => !existingIdeaChars.has(ch)).join(''), missingAfterDrafts: chars.filter(ch => !existingIdeaChars.has(ch) && !draftChars.has(ch)).join('')}
   };
  }
  const grades = {};
  for (const [grade, units] of Object.entries(curriculum)) grades[grade] = {
   ...coverage(units.map(([, text]) => text).join('')),
   units: units.map(([unit, text]) => ({unit, text, ...coverage(text)}))
  };
  return {id, grades, total: coverage(Object.values(curriculum).flatMap(units => units.map(([, text]) => text)).join(''))};
 });
 return {
  schemaVersion: 1, scope: allowSubset ? 'explicit-subset' : 'full', pack: {id: pack.id, version: pack.version, license: pack.license},
  limitations: [
   'Coverage counts structural availability, not naturalness, instructional acceptance or teacher certification.',
   'Writing-idea additions are agent-authored drafts; withDrafts is not reviewed prompt coverage.',
   'Exact pinned dictionary rows support lexical evidence. Lexical numbered readings do not verify audio or contextual pronunciation.',
   'Suggestions do not constrain the broad dictionary matcher. Unknown expressions remain unverified and ungraded.'
  ],
  provenance: {entries: entries.length, dictionaryMatched, dictionaryFilePinMatches,
   instructionallyReviewed: entries.filter(item => item.status?.instructional === 'fluent-reviewed').length,
   pendingFluentReview: entries.filter(item => item.status?.instructional === 'pending-fluent-review').length,
   ungradedDraftIdeas: entries.filter(item => item.writingIdea?.graded === false && item.writingIdea?.status === 'agent-authored-draft').length,
   issues}, catalogs: results
 };
}

function readJSON(file) {return JSON.parse(fs.readFileSync(file, 'utf8'));}
function fileEvidence(file) {
 const bytes = fs.readFileSync(file);
 return {path: path.relative(ROOT, file), bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')};
}
function readCatalog(file) {
 if (path.extname(file) === '.json') {
  const value = readJSON(file), cards = Array.isArray(value) ? value : value.cards;
  if (!Array.isArray(cards)) throw Error('Catalog JSON must be an array or {cards:[...]}: ' + file);
  return cards;
 }
 // Only isolate the static ALL declaration in the legacy snapshot; never run app startup.
 const line = fs.readFileSync(file, 'utf8').split('\n').find(line => line.startsWith('const ALL='));
 if (!line) throw Error('For a replacement catalog, pass a JSON array or {cards:[...]}; no static ALL declaration: ' + file);
 return vm.runInNewContext(line + '\n;ALL;', {}, {timeout: 1000});
}
function readPromptWords(file) {
 if (path.extname(file) === '.json') return readJSON(file).map(item => typeof item === 'string' ? item : item.words?.[0]).filter(Boolean);
 const context = vm.createContext({});
 const dependency = path.join(path.dirname(file), 'curriculum-ideas.js');
 if (fs.existsSync(dependency) && dependency !== file) vm.runInContext(fs.readFileSync(dependency, 'utf8'), context, {timeout: 1000});
 return vm.runInContext(fs.readFileSync(file, 'utf8') + '\n;CHARACTER_IDEAS;', context, {timeout: 1000}).map(item => item.words[0]);
}
function run(argv = process.argv.slice(2)) {
 const options = {catalogs: [], pack: path.join(ROOT, 'content/elementary-vocabulary.json'),
  dictionary: path.join(ROOT, 'vendor/cc-cedict/words.json'), curriculum: path.join(ROOT, 'tests/fixtures/better-immersion-k5.json'),
  writingIdeas: path.join(ROOT, 'vendor/writing-spark/character-ideas.js'), allowSubset: false};
 for (let i = 0; i < argv.length; i++) {
  const flag = argv[i];
  if (flag === '--subset') {options.allowSubset = true;continue;}
  if (flag === '--help') {
   process.stdout.write('Usage: node scripts/audit-vocabulary.cjs [--subset] [--catalog label=path.json]... [--pack path.json] [--dictionary path.json] [--curriculum path.json] [--writing-ideas path.json|path.js]\nJSON catalogs accept an array or {cards:[...]}; the default is current=content/curriculum.json. Use --subset only for a deliberately partial curriculum; full-scope audits reject missing grade/unit references. Output is JSON. Metadata errors exit 1; coverage gaps are reported without failing.\n');
   return;
  }
  const value = argv[++i];
  if (!value) throw Error('Missing value for ' + flag);
  if (flag === '--catalog') {
   const at = value.indexOf('=');
   if (at < 1 || at === value.length - 1) throw Error('Use --catalog label=path');
   options.catalogs.push({id: value.slice(0, at), path: path.resolve(value.slice(at + 1))});
  } else {
   const key = {'--pack': 'pack', '--dictionary': 'dictionary', '--curriculum': 'curriculum', '--writing-ideas': 'writingIdeas'}[flag];
   if (!key) throw Error('Unknown option: ' + flag);
   options[key] = path.resolve(value);
  }
 }
 if (!options.catalogs.length) options.catalogs.push({id: 'current', path: path.join(ROOT, 'content/curriculum.json')});
 const dictionaryEvidence = fileEvidence(options.dictionary);
 const report = auditVocabulary({pack: readJSON(options.pack), dictionary: readJSON(options.dictionary), dictionarySha256: dictionaryEvidence.sha256, allowSubset: options.allowSubset, curriculum: readJSON(options.curriculum),
  catalogs: options.catalogs.map(item => ({id: item.id, cards: readCatalog(item.path)})), promptWords: readPromptWords(options.writingIdeas)});
 const promptDependency = path.join(path.dirname(options.writingIdeas), 'curriculum-ideas.js');
 report.inputs = {pack: fileEvidence(options.pack), dictionary: dictionaryEvidence, curriculum: fileEvidence(options.curriculum),
  writingIdeas: fileEvidence(options.writingIdeas), catalogs: options.catalogs.map(item => ({id: item.id, ...fileEvidence(item.path)})),
  writingIdeaDependencies: path.extname(options.writingIdeas) === '.js' && fs.existsSync(promptDependency) ? [fileEvidence(promptDependency)] : []};
 process.stdout.write(JSON.stringify(report, null, 2) + '\n');
 if (report.provenance.issues.length) process.exitCode = 1;
}
if (require.main === module) {try {run();} catch (error) {process.stderr.write(error.message + '\n');process.exitCode = 1;}}
module.exports = {auditVocabulary};
