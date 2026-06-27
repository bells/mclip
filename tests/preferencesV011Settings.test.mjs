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

test("preferences translations include v0.1.1 settings in both languages", async () => {
  const source = await readSource("src/i18n.ts");

  for (const key of [
    "appearanceThemeLabel",
    "appearanceThemeSystem",
    "appearanceThemeLight",
    "appearanceThemeDark",
    "mainWindowItemCountLabel",
    "historyGroupItemCountLabel",
    "showHistoryItemNumbersLabel",
  ]) {
    assert.match(source, new RegExp(`${key}:`), `${key} should be translated`);
  }
});
