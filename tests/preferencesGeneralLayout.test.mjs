import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("general preferences lead with language and menu bar icon in a two-column row", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");
  const primaryGridIndex = source.indexOf("ui.settingsPrimaryGrid");
  const launchAtLoginIndex = source.indexOf("t.launchAtLoginLabel");
  const autoPasteIndex = source.indexOf("t.autoPasteLabel");

  assert.notEqual(primaryGridIndex, -1, "general tab should include a primary settings grid");
  assert.ok(
    primaryGridIndex < launchAtLoginIndex,
    "language and menu bar icon should appear before launch-at-login",
  );
  assert.ok(
    primaryGridIndex < autoPasteIndex,
    "language and menu bar icon should appear before auto paste",
  );
  assert.match(source, /className=\{ui\.settingsCompactField\}[^]*t\.languageLabel/);
  assert.match(source, /className=\{ui\.settingsCompactField\}[^]*t\.menuBarIconStyleLabel/);
});

test("menu bar icon style uses a compact select instead of option cards", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");

  assert.match(source, /className=\{ui\.menuBarIconSelect\}/);
  assert.match(source, /className=\{ui\.menuBarIconSelectControl\}/);
  assert.match(source, /value=\{settingsDraft\.menuBarIconStyle\}/);
  assert.match(
    source,
    /updateMenuBarIconStyle\(\s*event\.target\.value as MenuBarIconStyle,?\s*\)/,
  );
  assert.doesNotMatch(source, /app-menu-bar-icon-options/);
  assert.doesNotMatch(source, /role="radiogroup"/);
  assert.doesNotMatch(source, /app-menu-bar-icon-option/);
});

test("preference layout Tailwind classes define the compact primary grid and icon select", async () => {
  const stylesSource = await readSource("src/uiStyles.ts");

  assert.match(stylesSource, /settingsPrimaryGrid:[\s\S]*grid-cols-2/);
  assert.match(stylesSource, /settingsCompactField:/);
  assert.match(stylesSource, /settingsSelect:/);
  assert.match(stylesSource, /menuBarIconSelect:/);
  assert.match(stylesSource, /menuBarIconSelectPreview:/);
});
