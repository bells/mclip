import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("file history detail paths wrap instead of truncating", async () => {
  const stylesSource = await readSource("src/uiStyles.ts");

  assert.match(stylesSource, /historyDetailFile:[\s\S]*whitespace-normal/);
  assert.match(stylesSource, /historyDetailFile:[\s\S]*break-words/);
  assert.match(stylesSource, /historyDetailFile:[\s\S]*\[overflow-wrap:anywhere\]/);
  assert.doesNotMatch(stylesSource, /historyDetailFile:[\s\S]*truncate/);
});

test("history detail metadata renders one readable field per row", async () => {
  const stylesSource = await readSource("src/uiStyles.ts");
  const metaClass = stylesSource.match(/historyDetailMeta:\s*\n\s*"([^"]*)"/)?.[1];

  assert.ok(metaClass, "historyDetailMeta class should exist");
  assert.match(stylesSource, /historyDetailMeta:[\s\S]*grid[\s\S]*gap-\[5px\]/);
  assert.doesNotMatch(metaClass, /grid-cols-2/);
  assert.match(stylesSource, /historyDetailMetaItem:[\s\S]*grid-cols-\[86px_minmax\(0,1fr\)\]/);
  assert.match(stylesSource, /historyDetailMetaValue:[\s\S]*whitespace-normal/);
  assert.match(stylesSource, /historyDetailMetaValue:[\s\S]*\[overflow-wrap:anywhere\]/);
});

test("history detail content does not create empty filler below short values", async () => {
  const stylesSource = await readSource("src/uiStyles.ts");
  const contentClass = stylesSource.match(/historyDetailContent:\s*\n\s*"([^"]*)"/)?.[1];

  assert.ok(contentClass, "historyDetailContent class should exist");
  assert.doesNotMatch(contentClass, /min-h-full/);
});

test("independent history detail keeps metadata visible near the screen bottom", async () => {
  const [stylesSource, detailWindowSource] = await Promise.all([
    readSource("src/uiStyles.ts"),
    readSource("src/components/HistoryPreviewDetailWindow.tsx"),
  ]);

  assert.match(stylesSource, /historyPreviewDetailWindow:[\s\S]*h-screen/);
  assert.match(stylesSource, /historyDetailBody:[\s\S]*grid-rows-\[minmax\(0,1fr\)_auto\]/);
  assert.match(stylesSource, /historyDetailContentRegion:[\s\S]*overflow-y-auto/);
  assert.match(stylesSource, /historyDetailMeta:[\s\S]*shrink-0/);
  assert.match(detailWindowSource, /<HistoryDetailPanel/);
  assert.doesNotMatch(stylesSource, /historyGroupDetailPane/);
});
