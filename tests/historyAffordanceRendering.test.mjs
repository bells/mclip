import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("history rows share one affordance renderer and emoji-only text renders once", async () => {
  const [listSource, groupPreviewSource, listTextSource, detailSource] =
    await Promise.all([
      readSource("src/components/HistoryList.tsx"),
      readSource("src/components/HistoryGroupPreviewWindow.tsx"),
      readSource("src/components/HistoryListText.tsx"),
      readSource("src/components/HistoryPreviewDetailContent.tsx"),
    ]);

  for (const source of [listSource, groupPreviewSource]) {
    assert.match(source, /HistoryListText/);
  }

  for (const source of [listTextSource, detailSource]) {
    assert.match(source, /ui\.historyAffordance/);
    assert.match(source, /ui\.historyColorSwatch/);
    assert.match(source, /ui\.historyEmojiBadge/);
  }

  assert.match(listTextSource, /textAffordance\?\.kind === "emoji"/);
  assert.match(detailSource, /textAffordance\?\.kind === "emoji"/);
  assert.match(
    detailSource,
    /if \(textAffordance\?\.kind === "emoji"\) \{[\s\S]*?return \(/,
  );
});
