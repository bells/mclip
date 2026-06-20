import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("general preferences lead with language and menu bar icon in a two-column row", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");
  const primaryGridIndex = source.indexOf('className="app-settings-primary-grid"');
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
  assert.match(source, /className="app-settings-compact-field"[^]*t\.languageLabel/);
  assert.match(source, /className="app-settings-compact-field"[^]*t\.menuBarIconStyleLabel/);
});

test("menu bar icon style uses a compact select instead of option cards", async () => {
  const source = await readSource("src/components/PreferencesWindow.tsx");

  assert.match(source, /className="app-menu-bar-icon-select"/);
  assert.match(source, /className="app-settings-select app-menu-bar-icon-select-control"/);
  assert.match(source, /value=\{settingsDraft\.menuBarIconStyle\}/);
  assert.match(
    source,
    /updateMenuBarIconStyle\(\s*event\.target\.value as MenuBarIconStyle,?\s*\)/,
  );
  assert.doesNotMatch(source, /className="app-menu-bar-icon-options"/);
  assert.doesNotMatch(source, /role="radiogroup"/);
  assert.doesNotMatch(source, /app-menu-bar-icon-option/);
});

test("preference layout CSS defines the compact primary grid and icon select", async () => {
  const css = await readSource("src/App.css");

  assert.match(css, /\.app-settings-primary-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.app-settings-compact-field\s*\{/);
  assert.match(css, /\.app-settings-select\s*\{/);
  assert.match(css, /\.app-menu-bar-icon-select\s*\{/);
  assert.match(css, /\.app-menu-bar-icon-select-preview\s*\{/);
});
