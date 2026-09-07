import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
async function load(path) {
  const source = await readFile(path, 'utf8');
  const {outputText} = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}});
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const {createPayloadOperationGuard} = await load('src/utils/payloadOperationGuard.ts');
test('result writes reject double clicks and copy/replace overlap', () => {
  const guard = createPayloadOperationGuard();
  const token = guard.begin();
  assert.notEqual(token, null);
  assert.equal(guard.begin(), null);
  assert.equal(guard.isCurrent(token), true);
  guard.finish();
  assert.notEqual(guard.begin(), null);
});
test('new payload or close invalidates an old completion without permitting overlapping writes', () => {
  const guard = createPayloadOperationGuard();
  const token = guard.begin();
  guard.invalidate();
  assert.equal(guard.isCurrent(token), false);
  assert.equal(guard.begin(), null);
  guard.finish();
  const next = guard.begin();
  assert.notEqual(next, token);
  assert.equal(guard.isCurrent(next), true);
});
test('language stays in Appearance; display counts and retention remain searchable in History', async () => {
  const nav = await load('src/components/preferences/preferencesNavigation.ts');
  const destinations = nav.createPreferencesDestinations(key => key);
  const index = nav.createPreferenceSettingIndex(destinations, key => key);
  assert.equal(new Set(index.map(s=>s.id)).size,index.length);
  assert.equal(index.find(s=>s.id==='general.language').destinationId,'appearance');
  for (const id of ['history.main-count','history.group-count']) {
    assert.equal(index.find(s=>s.id===id).destinationId,'history');
  }
  for (const query of ['语言','language','言語']) {
    assert.ok(nav.filterPreferenceSettings(index,query).some(s=>s.id==='general.language'));
  }
  assert.equal(index.find(s=>s.id==='history.maximum').destinationId,'history');
});
