import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("general preferences use one three-column row with inline selectors", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");
  const primaryGridIndex = source.indexOf("ui.settingsPrimaryGrid");
  const languageIndex = source.indexOf("t.languageLabel");
  const appearanceIndex = source.indexOf("t.appearanceThemeLabel");
  const menuBarIconIndex = source.indexOf("t.menuBarIconStyleLabel");
  const launchAtLoginIndex = source.indexOf("t.launchAtLoginLabel");
  const autoPasteIndex = source.indexOf("t.autoPasteLabel");

  assert.notEqual(primaryGridIndex, -1, "general tab should include primary settings fields");
  assert.ok(
    languageIndex < appearanceIndex && appearanceIndex < menuBarIconIndex,
    "top settings should be ordered language, appearance, menu bar icon",
  );
  assert.ok(
    primaryGridIndex < launchAtLoginIndex,
    "top settings should appear before launch-at-login",
  );
  assert.ok(
    primaryGridIndex < autoPasteIndex,
    "top settings should appear before auto paste",
  );
  assert.match(source, /function SettingsSelectField/);
  assert.match(source, /<label className=\{ui\.settingsLabel\} htmlFor=\{controlId\}>/);
  assert.match(
    source,
    /<SettingsSelectField controlId=\{languageSelectId\} label=\{t\.languageLabel\}>/,
  );
  assert.match(source, /<option value="system">\{t\.languageSystem\}<\/option>/);
  assert.match(source, /controlId=\{appearanceThemeSelectId\}[^]*t\.appearanceThemeLabel/);
  assert.match(source, /controlId=\{menuBarIconStyleSelectId\}[^]*t\.menuBarIconStyleLabel/);
  assert.match(source, /id=\{languageSelectId\}/);
  assert.match(source, /id=\{appearanceThemeSelectId\}/);
  assert.match(source, /className=\{ui\.menuBarIconSelectTrigger\}[^]*id=\{controlId\}/);
});

test("preferences title is centered in the dialog status bar", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");

  assert.match(source, /<DialogStatusBar\s+centerTitle/);
});

test("item number visibility lives in the general tab", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");
  const generalIndex = source.indexOf('activeTab === "general"');
  const storageIndex = source.indexOf('activeTab === "storage"');
  const itemNumbersIndex = source.indexOf("t.showHistoryItemNumbersLabel");

  assert.notEqual(itemNumbersIndex, -1, "item number setting should be rendered");
  assert.ok(
    generalIndex < itemNumbersIndex && itemNumbersIndex < storageIndex,
    "item number setting should appear in the general tab before storage begins",
  );
  assert.doesNotMatch(
    source.slice(storageIndex),
    /t\.showHistoryItemNumbersLabel/,
    "storage tab should not render item number visibility",
  );
});

test("general switches use a compact checkbox control without row-click behavior", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");
  const stylesSource = await readSource("src/uiStyles.ts");
  const launchIndex = source.indexOf("label={t.launchAtLoginLabel}");
  const brandIndex = source.indexOf("label={t.showMainWindowBrandLabel}");
  const itemNumbersIndex = source.indexOf("label={t.showHistoryItemNumbersLabel}");
  const autoPasteIndex = source.indexOf("label={t.autoPasteLabel}");
  const switchItemStart = source.indexOf("function SettingsSwitchItem");
  const switchItemEnd = source.indexOf("export function PreferencesWindow");
  const switchItemSource = source.slice(switchItemStart, switchItemEnd);

  assert.match(source, /function SettingsSwitchItem/);
  assert.match(switchItemSource, /<div className=\{settingsSwitchRow\(disabled\)\}>/);
  assert.match(
    switchItemSource,
    /<button[\s\S]*aria-pressed=\{checked\}[\s\S]*onClick=\{onClick\}/,
  );
  assert.match(switchItemSource, /settingsSwitchBox\(checked\)/);
  assert.match(source, /label=\{t\.showHistoryItemNumbersLabel\}/);
  assert.doesNotMatch(source, /switchControl/);
  assert.doesNotMatch(switchItemSource, /<button[\s\S]*className=\{settingsSwitchRow/);
  assert.ok(
    launchIndex < brandIndex &&
      brandIndex < itemNumbersIndex &&
      itemNumbersIndex < autoPasteIndex,
    "general switches should be ordered launch, logo, item numbers, auto paste",
  );
  assert.match(stylesSource, /settingsSwitchRow:/);
  assert.match(stylesSource, /grid-cols-\[auto_minmax\(0,1fr\)\]/);
  assert.match(stylesSource, /settingsSwitchBox:/);
  assert.match(stylesSource, /settingsSwitchBoxOn:[\s\S]*#0a84ff/);
});

test("menu bar icon style uses an accessible image-only dropdown", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");

  assert.match(source, /value=\{settingsDraft\.menuBarIconStyle\}/);
  assert.match(source, /function MenuBarIconSelect/);
  assert.match(source, /aria-haspopup="listbox"/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /role="option"/);
  assert.match(source, /onChange\(option\.style\)/);
  assert.match(source, /onChange=\{updateMenuBarIconStyle\}/);
  assert.match(source, /document\.addEventListener\("focusin", handleFocusIn\)/);
  assert.match(source, /document\.removeEventListener\("focusin", handleFocusIn\)/);
  assert.match(source, /case "Escape":[\s\S]*event\.stopPropagation\(\)/);
  assert.match(source, /options\.map/);
  assert.match(source, /app-icon\.png/);
  assert.match(source, /menu-bar-icon-light-128\.png/);
  assert.match(source, /menu-bar-icon-m-128\.png/);
  assert.match(source, /<img[\s\S]*alt=""[\s\S]*aria-hidden="true"/);
  assert.doesNotMatch(source, /<option value="appIcon">/);
  assert.doesNotMatch(source, /role="radiogroup"/);
  assert.doesNotMatch(source, /onBlur=\{\(event\) =>/);
});

test("preference layout defines three usable columns for both languages", async () => {
  const [stylesSource, tauriConfigSource] = await Promise.all([
    readSource("src/uiStyles.ts"),
    readSource("src-tauri/tauri.conf.json"),
  ]);
  const preferencesWindow = JSON.parse(tauriConfigSource).app.windows.find(
    (window) => window.label === "preferences",
  );

  assert.match(stylesSource, /settingsPrimaryGrid: "grid grid-cols-3 gap-2"/);
  assert.match(
    stylesSource,
    /settingsSelectField:[\s\S]*grid-cols-\[max-content_auto\]/,
  );
  assert.match(stylesSource, /const settingsSelect =[\s\S]*w-\[104px\]/);
  assert.match(stylesSource, /menuBarIconSelectTrigger:[\s\S]*w-\[52px\]/);
  assert.doesNotMatch(stylesSource, /settingsCompactField:/);
  assert.deepEqual(
    {
      maxWidth: preferencesWindow.maxWidth,
      minWidth: preferencesWindow.minWidth,
      width: preferencesWindow.width,
    },
    { maxWidth: 760, minWidth: 760, width: 760 },
  );
});
