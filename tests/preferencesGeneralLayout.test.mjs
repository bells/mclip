import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("general preferences lead with language, appearance, and menu bar icon in one row", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");
  const primaryGridIndex = source.indexOf("ui.settingsPrimaryGrid");
  const languageIndex = source.indexOf("t.languageLabel");
  const appearanceIndex = source.indexOf("t.appearanceThemeLabel");
  const menuBarIconIndex = source.indexOf("t.menuBarIconStyleLabel");
  const launchAtLoginIndex = source.indexOf("t.launchAtLoginLabel");
  const autoPasteIndex = source.indexOf("t.autoPasteLabel");

  assert.notEqual(primaryGridIndex, -1, "general tab should include a primary settings grid");
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
  assert.match(source, /className=\{ui\.settingsCompactField\}[^]*t\.languageLabel/);
  assert.match(source, /<option value="system">\{t\.languageSystem\}<\/option>/);
  assert.match(source, /className=\{ui\.settingsCompactField\}[^]*t\.appearanceThemeLabel/);
  assert.match(source, /className=\{ui\.settingsCompactField\}[^]*t\.menuBarIconStyleLabel/);
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

  assert.match(source, /function SettingsSwitchItem/);
  assert.match(source, /<div className=\{settingsSwitchRow\(disabled\)\}>/);
  assert.match(source, /<button[\s\S]*aria-pressed=\{checked\}[\s\S]*onClick=\{onClick\}/);
  assert.match(source, /settingsSwitchBox\(checked\)/);
  assert.match(source, /label=\{t\.showHistoryItemNumbersLabel\}/);
  assert.doesNotMatch(source, /switchControl/);
  assert.doesNotMatch(source, /<button[\s\S]*className=\{settingsSwitchRow/);
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

test("menu bar icon style uses icon-only radio buttons", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");

  assert.match(source, /className=\{ui\.menuBarIconOptions\}/);
  assert.match(source, /role="radiogroup"/);
  assert.match(source, /role="radio"/);
  assert.match(source, /menuBarIconOptions\.map/);
  assert.match(source, /onClick=\{\(\) => updateMenuBarIconStyle\(option\.style\)\}/);
  assert.match(source, /menu-bar-icon-m-128\.png/);
  assert.doesNotMatch(source, /<option value="appIcon">/);
  assert.doesNotMatch(source, /<option value="m">/);
  assert.doesNotMatch(source, /<option value="light">\{t\.menuBarIconStyleLight\}<\/option>/);
  assert.doesNotMatch(source, /menuBarIconSelectControl/);
  assert.doesNotMatch(source, /app-menu-bar-icon-options/);
  assert.doesNotMatch(source, /app-menu-bar-icon-option/);
});

test("preference layout Tailwind classes define the compact primary grid and icon controls", async () => {
  const stylesSource = await readSource("src/uiStyles.ts");

  assert.match(stylesSource, /settingsPrimaryGrid:[\s\S]*grid-cols-3/);
  assert.match(stylesSource, /settingsCompactField:/);
  assert.match(stylesSource, /settingsSelect:/);
  assert.match(stylesSource, /menuBarIconOptions:/);
  assert.match(stylesSource, /menuBarIconOption:/);
});
