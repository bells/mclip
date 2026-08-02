import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("main window derives every selected surface from one active target", async () => {
  const [appSource, headerSource, listSource, groupSource, footerSource] =
    await Promise.all([
      readSource("src/App.tsx"),
      readSource("src/components/AppHeader.tsx"),
      readSource("src/components/HistoryList.tsx"),
      readSource("src/components/HistoryGroupNav.tsx"),
      readSource("src/components/AppFooter.tsx"),
    ]);

  assert.match(appSource, /useState\(MAIN_SEARCH_TARGET_ID\)/);
  assert.match(appSource, /activeMainTargetIdRef/);
  assert.match(appSource, /isActive=\{activeMainTarget\?\.kind === "search"\}/);
  assert.match(appSource, /selectedItemId=\{activeHistoryItemId \?\? undefined\}/);
  assert.match(appSource, /activeGroupIndex=\{activeHistoryGroupIndex\}/);
  assert.match(appSource, /selectedAction=\{activeFooterAction\}/);
  assert.match(headerSource, /className=\{ui\.search\(isActive\)\}/);
  assert.match(listSource, /selectedItemId === item\.id/);
  assert.match(groupSource, /const isActive = group\.index === activeGroupIndex/);
  assert.match(footerSource, /menuItem\(selectedAction === "preferences"/);
});

test("pointer activation is movement-driven and skips disabled footer actions", async () => {
  const [headerSource, listSource, groupSource, footerSource] = await Promise.all([
    readSource("src/components/AppHeader.tsx"),
    readSource("src/components/HistoryList.tsx"),
    readSource("src/components/HistoryGroupNav.tsx"),
    readSource("src/components/AppFooter.tsx"),
  ]);

  assert.match(headerSource, /onPointerMove=/);
  assert.match(listSource, /onPointerMove=/);
  assert.match(groupSource, /onPointerMove=/);
  assert.match(footerSource, /onPointerMove=/);
  assert.match(footerSource, /if \(element\.disabled\) \{\s*return;/);
  assert.doesNotMatch(listSource, /onMouseEnter=/);
  assert.doesNotMatch(groupSource, /onMouseEnter=/);
});

test("main target backgrounds depend on active state instead of parallel hover styling", async () => {
  const stylesSource = await readSource("src/uiStyles.ts");
  const historyRow = stylesSource.match(
    /export function historyItemRow[\s\S]*?\n\}/,
  )?.[0];
  const archiveRow = stylesSource.match(
    /export function archiveRow[\s\S]*?\n\}/,
  )?.[0];
  const historyButton = stylesSource.match(
    /export function historyItem\([\s\S]*?\n\}/,
  )?.[0];
  const footerRow = stylesSource.match(
    /export function menuItem[\s\S]*?\n\}/,
  )?.[0];
  const searchInput = stylesSource.match(
    /search: \(isActive: boolean\) =>[\s\S]*?\n\n  historyGroup:/,
  )?.[0];

  assert.ok(historyRow);
  assert.ok(historyButton);
  assert.ok(archiveRow);
  assert.ok(footerRow);
  assert.ok(searchInput);
  assert.match(stylesSource, /search: \(isActive: boolean\) =>/);
  assert.match(historyRow, /isSelected/);
  assert.match(searchInput, /border-\[var\(--mclip-accent-cool\)\]/);
  assert.doesNotMatch(searchInput, /focusRing/);
  assert.doesNotMatch(searchInput, /shadow-\[0_0_0/);
  assert.doesNotMatch(historyButton, /focusRing/);
  assert.doesNotMatch(archiveRow, /focusRing/);
  assert.doesNotMatch(footerRow, /focusRing/);
  assert.doesNotMatch(historyRow, /hover:bg/);
  assert.doesNotMatch(archiveRow, /hover:bg/);
  assert.doesNotMatch(footerRow, /hover:bg/);
});
