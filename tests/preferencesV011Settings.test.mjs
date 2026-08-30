import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readTranslationSources } from "./helpers/translations.mjs";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("preferences expose theme, visible item counts, and row number visibility", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");

  assert.match(source, /updateAppearanceTheme/);
  assert.match(source, /value=\{settingsDraft\.appearanceTheme\}/);
  assert.match(source, /updateVisibleItemCountInput\(\s*"mainWindowItemCount"/);
  assert.match(source, /updateVisibleItemCountInput\(\s*"historyGroupItemCount"/);
  assert.match(source, /commitVisibleItemCountInput\("mainWindowItemCount"\)/);
  assert.match(source, /commitVisibleItemCountInput\("historyGroupItemCount"\)/);
  assert.match(source, /settingsDraft\.showHistoryItemNumbers/);
  assert.match(source, /toggleHistoryItemNumbers/);
});

test("language settings support Chinese, English, Japanese, and the system language", async () => {
  const [constantsSource, settingsSource, languageSource, i18nSource] = await Promise.all([
    readSource("src/constants.ts"),
    readSource("src/utils/settings.ts"),
    readSource("src/utils/language.ts"),
    readTranslationSources(),
  ]);

  assert.match(constantsSource, /language:\s*"system"/);
  assert.match(settingsSource, /const APP_LANGUAGES:[\s\S]*"system"[\s\S]*"zhCn"[\s\S]*"en"[\s\S]*"ja"/);
  assert.match(languageSource, /startsWith\("zh"\)/);
  assert.match(languageSource, /startsWith\("ja"\)/);
  assert.match(languageSource, /return "en";/);
  assert.match(i18nSource, /languageSystem:/);
  assert.match(i18nSource, /languageJapanese:/);
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

test("archive groups default to 50 items and allow up to 100", async () => {
  const [constantsSource, rustSettingsSource, preferencesSource] = await Promise.all([
    readSource("src/constants.ts"),
    readSource("src-tauri/src/settings.rs"),
    readSource("src/components/PreferencesWindow.tsx"),
  ]);

  assert.match(constantsSource, /DEFAULT_HISTORY_GROUP_ITEM_COUNT\s*=\s*50/);
  assert.match(constantsSource, /MAX_HISTORY_GROUP_ITEM_COUNT\s*=\s*100/);
  assert.match(
    constantsSource,
    /historyGroupItemCount:\s*DEFAULT_HISTORY_GROUP_ITEM_COUNT/,
  );
  assert.match(rustSettingsSource, /DEFAULT_HISTORY_GROUP_ITEM_COUNT:\s*u32\s*=\s*50/);
  assert.match(rustSettingsSource, /MAX_HISTORY_GROUP_ITEM_COUNT:\s*u32\s*=\s*100/);
  assert.match(preferencesSource, /max=\{MAX_HISTORY_GROUP_ITEM_COUNT\}/);
});

test("history retention defaults to 200 entries and allows up to 500", async () => {
  const [constantsSource, rustSettingsSource, preferencesSource] = await Promise.all([
    readSource("src/constants.ts"),
    readSource("src-tauri/src/settings.rs"),
    readSource("src/components/PreferencesWindow.tsx"),
  ]);

  assert.match(constantsSource, /MAX_MAX_HISTORY_COUNT\s*=\s*500/);
  assert.match(constantsSource, /maxHistoryCount:\s*200/);
  assert.match(rustSettingsSource, /DEFAULT_MAX_HISTORY_COUNT:\s*u32\s*=\s*200/);
  assert.match(rustSettingsSource, /MAX_MAX_HISTORY_COUNT:\s*u32\s*=\s*500/);
  assert.match(preferencesSource, /max=\{MAX_MAX_HISTORY_COUNT\}/);
});

test("lowering max history count reconciles the main window item count", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");

  assert.match(
    source,
    /mainWindowItemCount:\s*clampMainWindowItemCount\([\s\S]*current\.mainWindowItemCount[\s\S]*clampedValue/,
  );
});

test("preferences translations include core settings in all languages", async () => {
  const source = await readTranslationSources();

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
