import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("main history list renders row numbers conditionally from settings", async () => {
  const historyListSource = await readSource("src/components/HistoryList.tsx");
  const appSource = await readSource("src/App.tsx");

  assert.match(historyListSource, /showItemNumbers: boolean/);
  assert.match(historyListSource, /showItemNumbers \?/);
  assert.match(appSource, /showItemNumbers=\{settings\.showHistoryItemNumbers\}/);
});

test("archive group preview renders row numbers conditionally from payload", async () => {
  const previewSource = await readSource(
    "src/components/HistoryGroupPreviewWindow.tsx",
  );
  const controllerSource = await readSource(
    "src/hooks/useHistoryPreviewController.ts",
  );

  assert.match(previewSource, /preview\.showHistoryItemNumbers \?/);
  assert.match(controllerSource, /showHistoryItemNumbers: settings\.showHistoryItemNumbers/);
});
