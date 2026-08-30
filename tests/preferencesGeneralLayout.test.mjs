import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("preferences use the six-page searchable settings center", async () => {
  const [windowSource, centerSource, navigationSource] = await Promise.all([
    readSource("src/components/PreferencesWindow.tsx"),
    readSource("src/components/preferences/PreferencesSettingsCenter.tsx"),
    readSource("src/components/preferences/preferencesNavigation.ts"),
  ]);

  assert.match(windowSource, /<PreferencesSettingsCenter/);
  assert.match(windowSource, /<DialogStatusBar\s+centerTitle/);
  for (const destination of [
    "general",
    "appearance",
    "history",
    "privacy",
    "textActions",
    "cli",
  ]) {
    assert.match(navigationSource, new RegExp(`id: "${destination}"`));
  }
  assert.match(centerSource, /filterPreferenceSettings/);
  assert.match(centerSource, /requestAnimationFrame/);
  assert.match(centerSource, /scrollIntoView/);
  assert.match(centerSource, /control\?\.focus\(\)/);
  assert.match(centerSource, /event\.key === "Escape" && query/);
  assert.match(centerSource, /event\.stopPropagation\(\)/);
});

test("settings rows expose accessible right-aligned switches", async () => {
  const [controlsSource, windowSource, stylesSource] = await Promise.all([
    readSource("src/components/preferences/PreferenceControls.tsx"),
    readSource("src/components/PreferencesWindow.tsx"),
    readSource("src/uiStyles.ts"),
  ]);

  assert.match(controlsSource, /role="switch"/);
  assert.match(controlsSource, /aria-checked=\{checked\}/);
  assert.match(windowSource, /role="switch"/);
  assert.match(stylesSource, /preferenceRowControl: "flex shrink-0 items-center justify-end/);
  assert.match(stylesSource, /preferenceSwitch: \(isOn: boolean\)/);
});

test("appearance and history keep their established controls and bounds", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");
  const appearanceIndex = source.indexOf("appearance: (");
  const historyIndex = source.indexOf("history: (");

  assert.ok(appearanceIndex >= 0 && historyIndex > appearanceIndex);
  assert.match(source.slice(appearanceIndex, historyIndex), /t\.appearanceThemeLabel/);
  assert.match(source.slice(appearanceIndex, historyIndex), /t\.menuBarIconStyleLabel/);
  assert.match(source.slice(appearanceIndex, historyIndex), /t\.showMainWindowBrandLabel/);
  assert.match(source.slice(appearanceIndex, historyIndex), /t\.showHistoryItemNumbersLabel/);
  assert.match(source.slice(historyIndex), /max=\{MAX_MAX_HISTORY_COUNT\}/);
  assert.match(source.slice(historyIndex), /max=\{mainWindowItemCountMax\}/);
  assert.match(source.slice(historyIndex), /max=\{MAX_HISTORY_GROUP_ITEM_COUNT\}/);
});

test("preferences keep a fixed lazy auxiliary window at 820 by 600", async () => {
  const [stylesSource, descriptorSource] = await Promise.all([
    readSource("src/uiStyles.ts"),
    readSource("src-tauri/src/auxiliary_window_contract.rs"),
  ]);

  assert.match(stylesSource, /grid-cols-\[220px_minmax\(0,1fr\)\]/);
  const preferencesDescriptor = descriptorSource.slice(
    descriptorSource.indexOf('label: "preferences"'),
  );
  assert.match(preferencesDescriptor, /width: 820\.0,[\s\S]*height: 600\.0/);
  assert.match(preferencesDescriptor, /min_size: Some\(LogicalWindowSize \{[\s\S]*width: 820\.0,[\s\S]*height: 600\.0/);
  assert.match(preferencesDescriptor, /max_size: Some\(LogicalWindowSize \{[\s\S]*width: 820\.0,[\s\S]*height: 600\.0/);
  assert.match(preferencesDescriptor, /focusable: true/);
});

test("menu bar icon selector retains listbox keyboard behavior", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");

  assert.match(source, /aria-haspopup="listbox"/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /role="option"/);
  assert.match(source, /case "Escape":[\s\S]*event\.stopPropagation\(\)/);
  assert.match(source, /document\.addEventListener\("focusin", handleFocusIn\)/);
});
