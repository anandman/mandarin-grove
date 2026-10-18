// Shared curriculum and pronunciation rules. No profile state is changed here.
function readings(card) {
  return [...new Set(card.p.split(/\s*\/\s*/).map(p => p.trim()).filter(Boolean))];
}
function pinyinBase(p) {
  return p.toLowerCase().normalize('NFD').replace(/u\u0308/g, 'v').replace(/[\u0300-\u036f]/g, '');
}
function pinyinTone(p) {
  const marks = ['\u0304', '\u0301', '\u030c', '\u0300'];
  return marks.findIndex(m => p.normalize('NFD').includes(m)) + 1;
}
function pinyinMatches(card, base, tone) {
  return readings(card).some(p => pinyinBase(p) === base && pinyinTone(p) === tone);
}
function pinyinLetters(card) {
  const counts = {};
  for (const p of readings(card)) {
    const own = {};
    for (const ch of pinyinBase(p)) own[ch] = (own[ch] || 0) + 1;
    for (const [ch, n] of Object.entries(own)) counts[ch] = Math.max(counts[ch] || 0, n);
  }
  return Object.entries(counts).flatMap(([ch, n]) => Array(n).fill(ch));
}
function samePronunciation(a, b) {
  return readings(a).some(p => readings(b).includes(p));
}
function speechText(card) {
  const context = {
    '假': '假期的假', '子': '子，子女的子', '狗': '狗，小狗的狗',
    '应': '应该的应', '处': '到处的处', '长': '长短的长',
    '答': '回答的答', '倒': '倒下的倒', '还': '还有的还',
    '觉': '感觉的觉', '结': '结冰的结', '了': '好了的了',
    '数': '数字的数', '种': '种子的种', '只': '一只猫的只',
    '着': '看着的着'
  };
  return context[card.c] || card.c;
}
function canonicalQuiz(chars, units) {
  const key = s => [...s].sort().join('');
  return (units.find(([, s]) => key(s) === key(chars)) || [0, chars])[1];
}
function cramCharacters(units, selected, cards) {
  const chars = new Set(units.filter(([n]) => selected.includes(n)).flatMap(([, s]) => [...s]));
  const byCharacter = new Map(cards.map(c => [c.c, c]));
  return [...chars].map(c => byCharacter.get(c)).filter(Boolean);
}
