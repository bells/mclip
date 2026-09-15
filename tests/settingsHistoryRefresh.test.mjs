import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile('src/hooks/useClipboardDataController.ts', 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));

test('mask toggles discard stale in-flight snapshots and refetch latest presentation', async () => {
  const effects = [], states = [], reads = [], events = {};
  const initialSettings = {maskSensitiveContent:true,mainWindowItemCount:10,historyGroupItemCount:50};
  const imports = {
    react: {
      useState(initial) { const state = {value:initial}; states.push(state); return [initial,value=>{state.value=value;}]; },
      useRef: current=>({current}), useMemo: callback=>callback(), useEffect: callback=>effects.push(callback),
    },
    '../constants': {DEFAULT_SETTINGS:initialSettings},
    '../services/ipc/commands': {
      getSettings: async()=>initialSettings,
      getHistorySnapshot: ()=>new Promise(resolve=>reads.push(resolve)),
    },
    '../services/ipc/events': {
      listenToHistoryChanged: async callback=>{events.history=callback; return ()=>{};},
      listenToSettingsUpdated: async callback=>{events.settings=callback; return ()=>{};},
      listenToSensitiveHistoryRevealFailed: async()=>()=>{},
    },
    '../utils/history': {filterHistoryItems:x=>x,getVisibleHistoryItems:x=>x,getHistoryGroups:()=>[],splitPinnedHistoryItems:unpinned=>({unpinned})},
    '../utils/searchInteraction': {getSearchQueryAfterHistorySelection:()=>''},
    '../utils/settings': {normalizeSettings:x=>x,requiresHistoryPresentationRefresh:(a,b)=>a.maskSensitiveContent!==b.maskSensitiveContent},
    '../services/performance': {recordFrontendPerformanceAfterPaint:()=>{}},
    '../utils/historyChanges': {applyHistoryChange:()=>({status:'needsReplace'})},
    '../utils/sensitiveContent': {maskSensitiveHistoryItems:x=>x},
  };
  const exports = {};
  vm.runInNewContext(compiled,{exports,require:name=>{assert.ok(imports[name],name);return imports[name];},console});
  exports.useClipboardDataController({onLikelyClipboardInsert:()=>{}});
  const cleanups = effects.map(effect=>effect());
  await flush();
  reads[0]({revision:1,entries:[]});
  await flush();
  events.settings({...initialSettings,appearanceTheme:'dark'});
  assert.equal(reads.length,1,'unrelated settings do not read history');
  events.settings({...initialSettings,maskSensitiveContent:false});
  assert.equal(reads.length,2);
  events.settings(initialSettings);
  assert.equal(reads.length,2,'masking changes retain a single in-flight read');
  reads[1]({revision:1,entries:[{text:'stale unmasked fixture'}]});
  await flush();
  assert.deepEqual(states[0].value.entries,[],'outdated unmasked result must never be committed');
  assert.equal(reads.length,3,'latest masking state gets a fresh request');
  reads[2]({revision:1,entries:[{text:'masked fixture'}]});
  await flush();
  assert.equal(states[0].value.entries[0].text,'masked fixture');
  events.settings({...initialSettings,maskSensitiveContent:false});
  cleanups.forEach(cleanup=>cleanup?.());
  reads[3]({revision:2,entries:[{text:'after unmount'}]});
  await flush();
  assert.equal(states[0].value.entries[0].text,'masked fixture');
});
