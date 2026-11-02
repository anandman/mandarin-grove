const test=require('node:test'),assert=require('node:assert/strict');
const {scaleNativeTextStyles}=require('../scripts/native-text-style.cjs');
test('native text adaptation preserves drawing geometry and unrelated attributes',()=>{
 const original='<svg viewBox="0 0 280 280"><text x="12" font-size="24">字</text></svg><canvas width="280" height="280"></canvas><style>.label{font-size:24px;line-height:32px;width:280px;height:280px;transform:translate(12px,5px)}</style>';
 const adapted=scaleNativeTextStyles(original);
 assert.ok(adapted.startsWith(original.split('<style>')[0]));
 for(const declaration of ['width:280px','height:280px','transform:translate(12px,5px)'])assert.ok(adapted.includes(declaration));
 assert.notEqual(adapted,original);assert.equal(scaleNativeTextStyles(adapted),adapted,'Exporting already-adapted declarations cannot compound text size');
});
test('inherited font semantics and non-style prose remain unchanged',()=>{
 const source='.control{font:inherit;font-size:inherit;line-height:1.5;font-family:"system-ui"} const note="A font-size choice";';
 assert.equal(scaleNativeTextStyles(source),source);
});
