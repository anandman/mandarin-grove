// Pure Help suggestions. This pack supplies examples, never answer acceptance or scores.
(function (root) {
 'use strict';
 const bundled = typeof module === 'object' && module.exports
  ? require('./content/elementary-vocabulary.json') : null;
 function groveVocabularyExamples(character, {limit = 3, pack = bundled} = {}) {
  if (typeof character !== 'string' || !/^\p{Script=Han}$/u.test(character.trim())) return [];
  const target = character.trim(), count = Number.isFinite(limit) ? Math.max(0, Math.min(40, Math.floor(limit))) : 3;
  if (!count || !Array.isArray(pack?.entries)) return [];
  return pack.entries.filter(item => item.status?.use === 'lookup-only'
   && item.status?.instructional !== 'quarantined'
   && [item.word, ...(item.aliases || [])].some(word => typeof word === 'string' && word.includes(target)))
   .slice(0, count).map(item => JSON.parse(JSON.stringify({
    ...item, packId: pack.id, packVersion: pack.version
   })));
 }
 function createGroveVocabularyLookup(pack) {
  // Snapshot explicitly supplied data, so a caller cannot change a bound lookup mid-session.
  const snapshot = pack ? JSON.parse(JSON.stringify(pack)) : null;
  return (character, options = {}) => groveVocabularyExamples(character, {...options, pack: snapshot});
 }
 const api = Object.freeze({examples: groveVocabularyExamples, bind: createGroveVocabularyLookup});
 if (typeof module === 'object' && module.exports) module.exports = api;
 else {root.GroveVocabulary = api;root.groveVocabularyExamples = groveVocabularyExamples;}
})(typeof globalThis === 'object' ? globalThis : this);
