const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = path.join(__dirname, '..', 'activities.js');

function runtime(extra = {}) {
  assert.ok(fs.existsSync(file), 'The independent activities module is present');
  const context = vm.createContext({ console, setTimeout, clearTimeout, ...extra });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'practice.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  return context;
}

test('pinyin output follows vowel priority and preserves ü and neutral tone', () => {
  const ctx = runtime();
  for (const [letters, tone, expected] of [['gou',3,'gǒu'],['nv',3,'nǚ'],['liu',2,'liú'],['gui',4,'guì'],['shui',3,'shuǐ'],['ma',0,'ma'],['xue',2,'xué']]) {
    assert.equal(ctx.pyMark(letters,tone), expected);
    assert.equal(ctx.pyBase(expected), letters);
    assert.equal(ctx.pyTone(expected), tone);
  }
});

test('word context escapes text and masks every occurrence when recalling', () => {
  const ctx = runtime();
  const card = { c:'狗', w:'狗和狗<&', wp:'gǒu' };
  const hidden = ctx.wordLine(card, true);
  assert.equal(hidden.includes('狗'), false);
  assert.equal((hidden.match(/missing character/g)||[]).length,2);
  assert.doesNotMatch(hidden,/<&/);
  assert.equal(ctx.wordLine({c:'狗',w:'',wp:''}), '');
});

test('Hanzi Writer loads local stroke data once and ignores a stale load callback', async () => {
  const data={strokes:['M0 0'],medians:[[[0,0],[1,1]]]};
  let options, requests=0, loaded=0;
  const box={clientWidth:300,innerHTML:'',isConnected:true};
  const ctx=runtime({NAV:1,document:{getElementById:()=>box},getComputedStyle:()=>({getPropertyValue:()=>''}),WritingSurface:{create:(target,char,opts)=>{options=opts;return {cancelQuiz(){}};}},STROKES:{},fetch:async()=>{requests++;return {ok:true,json:async()=>data};}});
  ctx.mkWriter({c:'祖'},true,()=>loaded++);
  assert.equal(options.showOutline,true);
  assert.equal(options.showCharacter,false);
  await options.charDataLoader('祖',()=>{});
  await options.charDataLoader('祖',()=>{});
  assert.equal(requests,1);
  options.onLoadCharDataSuccess(data);
  assert.equal(loaded,1);
  ctx.NAV=2;
  options.onLoadCharDataSuccess(data);
  assert.equal(loaded,1,'Navigating away suppresses the old ready callback');
});
