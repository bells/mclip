import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("main history and archive navigation share a Tailwind bounded scroll region", async () => {
  const [appSource, stylesSource] = await Promise.all([
    readSource("src/App.tsx"),
    readSource("src/uiStyles.ts"),
  ]);

  assert.match(appSource, /className=\{ui\.appFrame/);
  assert.match(appSource, /className=\{ui\.appPanel\}/);
  assert.match(appSource, /className=\{ui\.mainScrollRegion\}/);
  assert.match(appSource, /className=\{ui\.mainScrollContent\}/);
  assert.match(stylesSource, /appFrame:[\s\S]*h-screen/);
  assert.match(stylesSource, /appFrame:[\s\S]*overflow-hidden/);
  assert.match(stylesSource, /appPanel:[\s\S]*flex[\s\S]*h-full[\s\S]*min-h-0[\s\S]*flex-col[\s\S]*overflow-hidden/);
  assert.match(stylesSource, /mainScrollRegion:[\s\S]*min-h-0[\s\S]*flex-1[\s\S]*overflow-y-auto[\s\S]*overflow-x-hidden/);
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
  assert.match(stylesSource, /archiveList:[\s\S]*max-h-\[186px\]/);
  assert.match(stylesSource, /archiveList:[\s\S]*overflow-y-auto/);
  assert.match(stylesSource, /archiveRow[\s\S]*h-\[34px\]/);
});
