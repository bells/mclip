import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("main history and archive navigation scroll only when the window is height constrained", async () => {
  const [appSource, stylesSource] = await Promise.all([
    readSource("src/App.tsx"),
    readSource("src/uiStyles.ts"),
  ]);

  assert.match(appSource, /className=\{ui\.appFrame/);
  assert.match(appSource, /className=\{ui\.appPanel\}/);
  assert.match(appSource, /isMainScrollConstrained/);
  assert.match(appSource, /setIsMainScrollConstrained/);
  assert.match(appSource, /className=\{ui\.mainScrollRegion\(isMainScrollConstrained\)\}/);
  assert.match(appSource, /className=\{ui\.mainScrollContent\}/);
  assert.match(stylesSource, /appFrame:[\s\S]*h-screen/);
  assert.match(stylesSource, /appFrame:[\s\S]*overflow-hidden/);
  assert.match(stylesSource, /appPanel:[\s\S]*flex[\s\S]*h-full[\s\S]*min-h-0[\s\S]*flex-col[\s\S]*overflow-hidden/);
  assert.match(stylesSource, /mainScrollRegion:\s*\(isScrollable:\s*boolean\) =>/);
  assert.match(stylesSource, /isScrollable\s*\? "mclip-scrollbar overflow-y-auto"\s*:\s*"overflow-y-hidden"/);
  assert.match(stylesSource, /min-h-0[\s\S]*flex-1[\s\S]*overflow-x-hidden/);
  assert.match(stylesSource, /mainScrollRegion:[\s\S]*overscroll-contain/);
  assert.match(stylesSource, /mainScrollContent:[\s\S]*content-start/);
  assert.match(stylesSource, /appBody:[\s\S]*shrink-0/);
});

test("main window height follows measured content instead of row-count estimates", async () => {
  const [appSource, hookSource, commandSource] = await Promise.all([
    readSource("src/App.tsx"),
    readSource("src/hooks/useClipboardApp.ts"),
    readSource("src/services/ipc/commands.ts"),
  ]);

  assert.match(appSource, /ResizeObserver/);
  assert.match(appSource, /headerMeasureRef/);
  assert.match(appSource, /contentMeasureRef/);
  assert.match(appSource, /footerMeasureRef/);
  assert.match(appSource, /adjustWindowHeightToContent\(contentWindowHeight\)/);
  assert.doesNotMatch(hookSource, /adjustWindowHeight\(/);
  assert.match(commandSource, /adjustWindowHeightToContent/);
  assert.match(commandSource, /"adjust_window_height_to_content"/);
});

test("main footer and archive groups keep the compact one-row-per-action contract", async () => {
  const stylesSource = await readSource("src/uiStyles.ts");

  assert.match(stylesSource, /footer:[\s\S]*grid-cols-1/);
  assert.match(stylesSource, /menuItem[\s\S]*min-h-\[26px\]/);
  assert.match(stylesSource, /menuItem[\s\S]*grid-cols-\[minmax\(112px,1fr\)_minmax\(0,1fr\)\]/);
  const archiveListMatch = stylesSource.match(/archiveList:\s*"([^"]+)"/);
  assert.ok(archiveListMatch);
  assert.doesNotMatch(archiveListMatch[1], /mclip-scrollbar/);
  assert.doesNotMatch(archiveListMatch[1], /max-h-\[186px\]/);
  assert.doesNotMatch(archiveListMatch[1], /overflow-y-auto/);
  assert.match(stylesSource, /archiveRow[\s\S]*h-\[28px\]/);
});

test("history row density keeps images at 2x text and archive navigation compact", async () => {
  const [stylesSource, listSource, groupPreviewSource] = await Promise.all([
    readSource("src/uiStyles.ts"),
    readSource("src/components/HistoryList.tsx"),
    readSource("src/components/HistoryGroupPreviewWindow.tsx"),
  ]);

  assert.match(stylesSource, /const historyTextRowHeight = "h-8"/);
  assert.match(stylesSource, /const historyImageRowHeight = "h-16"/);
  assert.match(stylesSource, /kind === "image"/);
  assert.match(stylesSource, /archiveRow[\s\S]*h-\[28px\]/);
  assert.match(stylesSource, /archive: "-mt-1[^"]*pb-0/);
  assert.match(
    stylesSource,
    /archiveDivider:\s*\n\s*"[^"]*-mb-px[^"]*h-px/,
  );
  assert.match(listSource, /historyItemRow\(\s*item\.kind/);
  assert.match(listSource, /historyItem\(item\.kind, showItemNumbers\)/);
  assert.match(groupPreviewSource, /previewItemRow\(\s*item\.kind/);
  assert.match(
    groupPreviewSource,
    /previewItem\(\s*item\.kind,\s*preview\.showHistoryItemNumbers/,
  );
});

test("main history rows and archive rows align their leading affordance with footer icons", async () => {
  const stylesSource = await readSource("src/uiStyles.ts");
  const appBodyMatch = stylesSource.match(/appBody:\s*"([^"]+)"/);
  const archiveMatch = stylesSource.match(/archive:\s*"([^"]+)"/);
  const footerMatch = stylesSource.match(/footer:\s*\n\s*"([^"]+)"/);
  const itemIndexMatch = stylesSource.match(/itemIndex:\s*\n\s*"([^"]+)"/);
  const historyPreviewIndexMatch = stylesSource.match(
    /historyPreviewIndex:\s*\n\s*"([^"]+)"/,
  );
  const historyItemMatch = stylesSource.match(
    /export function historyItem\([\s\S]*?return \[([\s\S]*?)\n\s*\]\.join/,
  );
  const archiveRowMatch = stylesSource.match(
    /export function archiveRow[\s\S]*?return \[([\s\S]*?)\n\s*\]\.join/,
  );
  const previewItemMatch = stylesSource.match(
    /export function previewItem\([\s\S]*?return \[([\s\S]*?)\n\s*\]\.join/,
  );
  const menuItemMatch = stylesSource.match(
    /export function menuItem[\s\S]*?return \[([\s\S]*?)\n\s*\]\.join/,
  );

  assert.ok(appBodyMatch);
  assert.ok(archiveMatch);
  assert.ok(footerMatch);
  assert.ok(itemIndexMatch);
  assert.ok(historyPreviewIndexMatch);
  assert.ok(historyItemMatch);
  assert.ok(archiveRowMatch);
  assert.ok(previewItemMatch);
  assert.ok(menuItemMatch);
  assert.match(appBodyMatch[1], /px-\[6px\]/);
  assert.match(archiveMatch[1], /px-\[6px\]/);
  assert.match(footerMatch[1], /px-\[6px\]/);
  assert.match(itemIndexMatch[1], /min-w-\[14px\]/);
  assert.match(itemIndexMatch[1], /text-left/);
  assert.match(historyPreviewIndexMatch[1], /min-w-\[14px\]/);
  assert.match(historyPreviewIndexMatch[1], /text-left/);
  assert.match(historyItemMatch[1], /gap-1\.5/);
  assert.match(historyItemMatch[1], /pl-1\.5/);
  assert.match(historyItemMatch[1], /pr-2/);
  assert.match(
    historyItemMatch[1],
    /grid-cols-\[minmax\(14px,max-content\)_minmax\(0,1fr\)\]/,
  );
  assert.match(archiveRowMatch[1], /grid-cols-\[14px_minmax\(0,1fr\)_18px\]/);
  assert.match(archiveRowMatch[1], /gap-1\.5/);
  assert.match(archiveRowMatch[1], /pl-1\.5/);
  assert.match(archiveRowMatch[1], /pr-\[10px\]/);
  assert.match(previewItemMatch[1], /gap-1\.5/);
  assert.match(previewItemMatch[1], /pl-1\.5/);
  assert.match(previewItemMatch[1], /pr-2/);
  assert.match(
    previewItemMatch[1],
    /grid-cols-\[minmax\(14px,max-content\)_minmax\(0,1fr\)\]/,
  );
  assert.match(menuItemMatch[1], /pl-1\.5/);
  assert.match(menuItemMatch[1], /pr-2/);
});
