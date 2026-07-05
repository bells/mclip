import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("preferences expose theme, visible item counts, and row number visibility", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");

  assert.match(source, /updateAppearanceTheme/);
  assert.match(source, /value=\{settingsDraft\.appearanceTheme\}/);
  assert.match(source, /updateVisibleItemCount\(\s*"mainWindowItemCount"/);
  assert.match(source, /updateVisibleItemCount\(\s*"historyGroupItemCount"/);
  assert.match(source, /settingsDraft\.showHistoryItemNumbers/);
  assert.match(source, /toggleHistoryItemNumbers/);
});

test("language settings support following the system language", async () => {
  const [constantsSource, settingsSource, languageSource, i18nSource] = await Promise.all([
    readSource("src/constants.ts"),
    readSource("src/utils/settings.ts"),
    readSource("src/utils/language.ts"),
    readSource("src/i18n.ts"),
  ]);

  assert.match(constantsSource, /language:\s*"system"/);
  assert.match(settingsSource, /const APP_LANGUAGES:[\s\S]*"system"[\s\S]*"zhCn"[\s\S]*"en"/);
  assert.match(languageSource, /startsWith\("zh"\)/);
  assert.match(languageSource, /return "en";/);
  assert.match(i18nSource, /languageSystem:/);
  assert.match(i18nSource, /resolveAppLanguage\(language\)/);
});

test("main window count uses max history count as its dynamic maximum", async () => {
  const preferencesSource = await readSource("src/components/PreferencesWindow.tsx");
  const constantsSource = await readSource("src/constants.ts");
  const settingsSource = await readSource("src/utils/settings.ts");

  assert.match(constantsSource, /clampMainWindowItemCount/);
  assert.match(constantsSource, /clampHistoryGroupItemCount/);
  assert.doesNotMatch(constantsSource, /export function clampVisibleItemCount/);
  assert.match(
    settingsSource,
    /mainWindowItemCount:\s*clampMainWindowItemCount\([\s\S]*settings\.maxHistoryCount/,
  );
  assert.match(
    preferencesSource,
    /const mainWindowItemCountMax\s*=\s*settingsDraft\.maxHistoryCount/,
  );
  assert.match(preferencesSource, /max=\{mainWindowItemCountMax\}/);
  assert.match(preferencesSource, /t\.rangeNote\(MIN_VISIBLE_ITEM_COUNT,\s*mainWindowItemCountMax\)/);
});

test("lowering max history count reconciles the main window item count", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");

  assert.match(
    source,
    /mainWindowItemCount:\s*clampMainWindowItemCount\([\s\S]*current\.mainWindowItemCount[\s\S]*clampedValue/,
  );
});

test("preferences translations include v0.1.1 settings in both languages", async () => {
  const source = await readSource("src/i18n.ts");

  for (const key of [
    "appearanceThemeLabel",
    "appearanceThemeSystem",
    "appearanceThemeLight",
    "appearanceThemeDark",
    "languageSystem",
    "mainWindowItemCountLabel",
    "historyGroupItemCountLabel",
    "showHistoryItemNumbersLabel",
  ]) {
    assert.match(source, new RegExp(`${key}:`), `${key} should be translated`);
  }
});
