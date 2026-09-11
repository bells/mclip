import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function moduleUrl(path, replacements = {}) {
  let source = await readFile(path, 'utf8');
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(from, to);
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const constantsUrl = await moduleUrl('src/constants.ts');
const { DEFAULT_SETTINGS, clampMaxPinnedItems } = await import(constantsUrl);
const { normalizeSettings } = await import(await moduleUrl('src/utils/settings.ts', { '../constants': constantsUrl }));
const { getPinFailureNotice, getNumericHistoryTargetId, createPinActionController } = await import(await moduleUrl('src/utils/pinHistory.ts'));
const { getVisibleHistoryItems, filterHistoryItems } = await import(await moduleUrl('src/utils/history.ts'));
const { createPreferenceSaveController } = await import(await moduleUrl('src/components/preferences/preferenceSaveController.ts'));
const base = { key: '1', hasModifier: false, isEditing: false, isComposing: false, repeat: false, blocked: false };
const items = Array.from({ length: 15 }, (_, i) => ({
  id: `item-${i}`, kind: 'text', text: `fixture-${i}`, displayText: `fixture-${i}`,
  sourceApp: null, copyCount: 1, firstCopiedAt: 1, lastCopiedAt: 100-i,
  isPinned: i < 3, pinnedAt: i < 3 ? 100-i : null, position: i + 1,
}));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };

test('pin configuration defaults and normalizes valid integer boundaries', () => {
  assert.equal(DEFAULT_SETTINGS.maxPinnedItems, 10);
  for (const [value, expected] of [[undefined,10],[null,10],['5',10],[NaN,10],[Infinity,10],[5.5,10],[4,5],[5,5],[20,20],[21,20]]) {
    assert.equal(clampMaxPinnedItems(value), expected);
    assert.equal(normalizeSettings({ ...DEFAULT_SETTINGS, maxPinnedItems: value }).maxPinnedItems, expected);
  }
});

test('ordinary numbering follows filtered main rows while identities and original positions remain stable', () => {
  const visible = getVisibleHistoryItems(items, 10);
  assert.deepEqual(visible.slice(3).map(e=>e.position), [1,2,3,4,5,6,7,8,9,10]);
  assert.equal(items[3].position, 4);
  const unpinned = items.map((item, index) => index === 0 ? { ...item, isPinned: false } : item);
  assert.deepEqual(getVisibleHistoryItems(unpinned, 10).filter(item => !item.isPinned).map(item => item.position), [1,2,3,4,5,6,7,8,9,10]);
  const newlyPinned = items.map((item, index) => index === 3 ? { ...item, isPinned: true } : item);
  assert.equal(getVisibleHistoryItems(newlyPinned, 10).find(item => !item.isPinned).id, 'item-4');
  const searched = getVisibleHistoryItems(filterHistoryItems(items, 'fixture-1'), 10);
  assert.deepEqual(searched.filter(e=>!e.isPinned).map(e=>e.position), [1,2,3,4,5]);
  assert.deepEqual(getVisibleHistoryItems(items.slice(0,3), 10), items.slice(0,3));
  assert.equal(getVisibleHistoryItems(items.slice(3), 10)[0].position, 1);
});

test('numeric selection ignores pins, respects displayed slice and does not capture editing or special modes', () => {
  const visible = getVisibleHistoryItems(items, 10);
  for (let n=1;n<=9;n++) assert.equal(getNumericHistoryTargetId(visible,{...base,key:String(n)}), `item-${n+2}`);
  assert.equal(getNumericHistoryTargetId(visible,{...base,key:'0'}),'item-12');
  assert.equal(getNumericHistoryTargetId(visible.slice(0,5),{...base,key:'0'}),null);
  assert.equal(getNumericHistoryTargetId(items.slice(0,3),base),null);
  for (const flag of ['hasModifier','isEditing','isComposing','repeat','blocked']) assert.equal(getNumericHistoryTargetId(visible,{...base,[flag]:true}),null);
  for (const key of ['a','10','ArrowDown','Enter']) assert.equal(getNumericHistoryTargetId(visible,{...base,key}),null);
});

test('error narrowing carries only codes and valid counts, never raw payload data', () => {
  const limit = { code:'pinnedHistoryLimitReached',current:10,max:10 };
  assert.deepEqual(getPinFailureNotice({...limit,message:'private content',path:'/private/path'}),limit);
  for (const error of [null, 'pinnedHistoryLimitReached: 10', {}, {...limit,current:9}, {...limit,max:21}, {...limit,current:NaN}, {...limit,current:'10'}]) assert.deepEqual(getPinFailureNotice(error),{code:'historyMutationFailed'});
});

test('pin controller deduplicates pending clicks and routes a single failure', async () => {
  const request = deferred(); let calls=0; const notices=[]; const pending=[];
  const controller = createPinActionController({toggle:()=>{calls++; return request.promise;},isVisible:async()=>true,report:async notice=>notices.push(notice),onPending:value=>pending.push(value)});
  const first = controller.toggle('id'); await controller.toggle('id');
  request.reject({code:'pinnedHistoryLimitReached',current:10,max:10}); await first;
  assert.equal(calls,1); assert.equal(notices.length,1); assert.deepEqual(pending,[true,false]);
});

test('pin controller drops stale and hidden-window failures, including during visibility checks', async () => {
  for (const mode of ['stale','hidden','visibility-race','target-gone']) {
    const request=deferred(), visibility=deferred(); const notices=[];
    const controller=createPinActionController({toggle:()=>request.promise,isVisible:()=>visibility.promise,report:async n=>{ if(mode==='target-gone') throw new Error('gone'); notices.push(n); },onPending:()=>{}});
    const running=controller.toggle('id');
    if(mode==='stale') controller.invalidate();
    request.reject(new Error('private runtime details'));
    await Promise.resolve();
    if(mode==='visibility-race') controller.invalidate();
    visibility.resolve(mode!=='hidden');
    await running;
    assert.equal(notices.length,0);
  }
});

test('pin preference shares immediate save, serialized updates and failure rollback', async () => {
  const pending=deferred(); const calls=[];
  const controller=createPreferenceSaveController({initialSettings:DEFAULT_SETTINGS,normalize:normalizeSettings,onSettings:()=>{},onFeedback:()=>{},save:async s=>{calls.push(s.maxPinnedItems); await pending.promise; return s;}});
  const first=controller.apply('history.pin-limit',s=>({...s,maxPinnedItems:5}));
  assert.equal(controller.getLatest().maxPinnedItems,5);
  const second=controller.apply('history.pin-limit',s=>({...s,maxPinnedItems:20}));
  await Promise.resolve(); assert.deepEqual(calls,[5]); pending.resolve(); await Promise.all([first,second]); assert.deepEqual(calls,[5,20]);
  const failed=createPreferenceSaveController({initialSettings:DEFAULT_SETTINGS,normalize:normalizeSettings,onSettings:()=>{},onFeedback:()=>{},save:async()=>{throw new Error('failed');}});
  await failed.apply('history.pin-limit',s=>({...s,maxPinnedItems:5}));
  assert.equal(failed.getLatest().maxPinnedItems,10);
});
