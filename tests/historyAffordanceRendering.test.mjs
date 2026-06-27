import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("color and emoji affordances render in history rows and detail content", async () => {
  const [listSource, groupPreviewSource, detailSource] = await Promise.all([
    readSource("src/components/HistoryList.tsx"),
    readSource("src/components/HistoryGroupPreviewWindow.tsx"),
    readSource("src/components/HistoryPreviewDetailContent.tsx"),
  ]);

  for (const source of [listSource, groupPreviewSource, detailSource]) {
    assert.match(source, /getTextHistoryAffordance/);
    assert.match(source, /app-history-affordance/);
    assert.match(source, /app-history-color-swatch/);
    assert.match(source, /app-history-emoji-badge/);
  }
});
