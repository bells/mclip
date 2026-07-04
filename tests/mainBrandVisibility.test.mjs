import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("settings contract includes main window brand visibility", async () => {
  const typesSource = await readSource("src/types.ts");
  const constantsSource = await readSource("src/constants.ts");
  const settingsSource = await readSource("src/utils/settings.ts");

  assert.match(typesSource, /showMainWindowBrand: boolean/);
  assert.match(constantsSource, /showMainWindowBrand:\s*true/);
  assert.match(
    settingsSource,
    /showMainWindowBrand:\s*settings\.showMainWindowBrand !== false/,
  );
});

test("preferences expose a General toggle for the main window brand", async () => {
  const preferencesSource = await readSource("src/components/PreferencesWindow.tsx");
  const translationsSource = await readSource("src/i18n.ts");

  assert.match(preferencesSource, /toggleMainWindowBrand/);
  assert.match(preferencesSource, /settingsDraft\.showMainWindowBrand/);
  assert.match(preferencesSource, /t\.showMainWindowBrandLabel/);
  assert.match(preferencesSource, /t\.showMainWindowBrandDescription/);

  for (const key of [
    "showMainWindowBrandLabel",
    "showMainWindowBrandDescription",
  ]) {
    assert.match(translationsSource, new RegExp(`${key}:`));
  }
});

test("main header renders the brand conditionally from settings", async () => {
  const appSource = await readSource("src/App.tsx");
  const headerSource = await readSource("src/components/AppHeader.tsx");

  assert.match(appSource, /showBrand=\{settings\.showMainWindowBrand\}/);
  assert.match(headerSource, /showBrand: boolean/);
  assert.match(headerSource, /showBrand \? \(/);
  assert.match(headerSource, /className=\{ui\.brandHidden\}/);
});
