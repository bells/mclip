import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("general preferences stack interface fields into task groups", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");
  const interfaceGroupIndex = source.indexOf("t.interfaceGroupLabel");
  const behaviorGroupIndex = source.indexOf("t.behaviorGroupLabel");
  const mainWindowGroupIndex = source.indexOf("t.mainWindowGroupLabel");
  const languageIndex = source.indexOf("t.languageLabel");
  const appearanceIndex = source.indexOf("t.appearanceThemeLabel");
  const menuBarIconIndex = source.indexOf("t.menuBarIconStyleLabel");
  const launchAtLoginIndex = source.indexOf("t.launchAtLoginLabel");
  const autoPasteIndex = source.indexOf("t.autoPasteLabel");
  const brandIndex = source.indexOf("t.showMainWindowBrandLabel");
  const itemNumbersIndex = source.indexOf("t.showHistoryItemNumbersLabel");

  assert.notEqual(interfaceGroupIndex, -1, "general tab should include an interface group");
  assert.ok(
    languageIndex < appearanceIndex && appearanceIndex < menuBarIconIndex,
    "interface settings should be ordered language, appearance, menu bar icon",
  );
  assert.ok(
    interfaceGroupIndex < behaviorGroupIndex && behaviorGroupIndex < mainWindowGroupIndex,
    "general groups should be ordered interface, behavior, main window",
  );
  assert.ok(
    launchAtLoginIndex < autoPasteIndex,
    "launch at login should precede auto paste",
  );
  assert.ok(
    brandIndex < itemNumbersIndex,
    "main window logo should precede item number visibility",
  );
  assert.match(source, /function SettingsGroup/);
  assert.match(source, /function SettingsSelectField/);
  assert.match(source, /description: string/);
  assert.match(source, /<label className=\{ui\.settingsLabel\} htmlFor=\{controlId\}>/);
  assert.match(
    source,
    /<SettingsSelectField[\s\S]*controlId=\{languageSelectId\}[\s\S]*description=\{t\.languageDescription\}/,
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
    launchIndex < autoPasteIndex &&
      autoPasteIndex < brandIndex &&
      brandIndex < itemNumbersIndex,
    "general switches should be grouped as behavior followed by main window",
  );
  assert.match(stylesSource, /settingsSwitchRow:/);
  assert.match(stylesSource, /grid-cols-\[auto_minmax\(0,1fr\)\]/);
  assert.match(stylesSource, /settingsSwitchBox:/);
  assert.match(
    stylesSource,
    /settingsSwitchBoxOn:[\s\S]*var\(--mclip-control-active\)[\s\S]*var\(--mclip-on-control-active\)/,
  );
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

test("preference layout uses compact fixed bounds and stacked rows", async () => {
  const [stylesSource, auxiliaryContractSource] = await Promise.all([
    readSource("src/uiStyles.ts"),
    readSource("src-tauri/src/auxiliary_window_contract.rs"),
  ]);

  assert.doesNotMatch(stylesSource, /settingsPrimaryGrid:/);
  assert.match(
    stylesSource,
    /settingsSelectField:[\s\S]*grid-cols-\[minmax\(0,1fr\)_auto\]/,
  );
  assert.match(stylesSource, /const settingsSelect =[\s\S]*w-\[152px\]/);
  assert.match(stylesSource, /menuBarIconSelectTrigger:[\s\S]*w-\[52px\]/);
  assert.match(auxiliaryContractSource, /label: "preferences"/);
  assert.match(auxiliaryContractSource, /width: 600\.0,[\s\S]*height: 480\.0/);
  assert.match(auxiliaryContractSource, /min_size: Some\(LogicalWindowSize \{[\s\S]*width: 600\.0,[\s\S]*height: 480\.0/);
  assert.match(auxiliaryContractSource, /max_size: Some\(LogicalWindowSize \{[\s\S]*width: 600\.0,[\s\S]*height: 480\.0/);
});

test("history preferences use history terminology and task order", async () => {
  const [source, i18nSource] = await Promise.all([
    readSource("src/components/PreferencesWindow.tsx"),
    readSource("src/i18n.ts"),
  ]);
  const storagePanelIndex = source.indexOf('activeTab === "storage"');
  const typesIndex = source.indexOf("t.typesLabel", storagePanelIndex);
  const maxHistoryIndex = source.indexOf("t.maxHistoryCountLabel", storagePanelIndex);
  const mainCountIndex = source.indexOf("t.mainWindowItemCountLabel", storagePanelIndex);
  const groupCountIndex = source.indexOf("t.historyGroupItemCountLabel", storagePanelIndex);

  assert.match(source, /\["storage", t\.historyTab\]/);
  assert.ok(
    typesIndex < maxHistoryIndex &&
      maxHistoryIndex < mainCountIndex &&
      mainCountIndex < groupCountIndex,
    "history settings should be ordered types, maximum, main count, group count",
  );
  assert.match(i18nSource, /historyTab: "历史"/);
  assert.match(i18nSource, /historyTab: "History"/);
});
