import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("keyboard navigation suppresses stale hover affordances through class state", async () => {
  const [stylesSource, listSource, groupPreviewSource] = await Promise.all([
    readSource("src/uiStyles.ts"),
    readSource("src/components/HistoryList.tsx"),
    readSource("src/components/HistoryGroupPreviewWindow.tsx"),
  ]);

  assert.match(stylesSource, /historyItemRow\(isSelected: boolean, isKeyboardNavigating: boolean\)/);
  assert.match(stylesSource, /historyDeleteButton\(isVisible: boolean\)/);
  assert.match(stylesSource, /previewItemRow\(isSelected: boolean, isKeyboardNavigating: boolean\)/);
  assert.match(stylesSource, /previewDeleteButton\(isVisible: boolean\)/);
  assert.match(stylesSource, /isKeyboardNavigating[\s\S]*hover:bg-transparent/);
  assert.match(stylesSource, /isVisible[\s\S]*opacity-100[\s\S]*pointer-events-auto/);
  assert.match(stylesSource, /opacity-0[\s\S]*pointer-events-none/);
  assert.match(listSource, /isKeyboardNavigating: boolean/);
  assert.match(groupPreviewSource, /isKeyboardNavigating/);
});
