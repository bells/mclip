import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("history deletion is owned by shared detail actions", async () => {
  const [
    stylesSource,
    listSource,
    detailPanelSource,
    deleteActionSource,
    itemPreviewSource,
    groupPreviewSource,
    detailWindowSource,
    previewWindowSource,
  ] = await Promise.all([
    readSource("src/uiStyles.ts"),
    readSource("src/components/HistoryList.tsx"),
    readSource("src/components/HistoryDetailPanel.tsx"),
    readSource("src/components/HistoryDetailDeleteButton.tsx"),
    readSource("src/components/HistoryItemPreviewWindow.tsx"),
    readSource("src/components/HistoryGroupPreviewWindow.tsx"),
    readSource("src/components/HistoryPreviewDetailWindow.tsx"),
    readSource("src/components/HistoryPreviewWindow.tsx"),
  ]);

  assert.match(
    stylesSource,
    /historyItemRow\([\s\S]*kind: HistoryKind,[\s\S]*isSelected: boolean,[\s\S]*isKeyboardNavigating: boolean/,
  );
  assert.doesNotMatch(stylesSource, /historyDeleteButton\(isVisible: boolean\)/);
  assert.match(stylesSource, /historyDetailActionButton/);
  assert.match(
    stylesSource,
    /previewItemRow\([\s\S]*kind: HistoryKind,[\s\S]*isSelected: boolean,[\s\S]*isKeyboardNavigating: boolean/,
  );
  assert.match(stylesSource, /isKeyboardNavigating[\s\S]*hover:bg-transparent/);
  assert.match(listSource, /isKeyboardNavigating: boolean/);
  assert.doesNotMatch(listSource, /onDeleteItem/);
  assert.doesNotMatch(listSource, /TrashIcon/);
  assert.match(detailPanelSource, /headerAction/);
  assert.match(deleteActionSource, /HistoryDetailDeleteButton/);
  assert.match(deleteActionSource, /TrashIcon/);
  assert.match(itemPreviewSource, /<HistoryDetailDeleteButton/);
  assert.match(groupPreviewSource, /isKeyboardNavigating/);
  assert.doesNotMatch(groupPreviewSource, /onDeleteItem|TrashIcon/);
  assert.match(detailWindowSource, /<HistoryDetailDeleteButton/);
  assert.match(detailWindowSource, /await deleteHistoryItem\(preview\.item\.id\)/);
  assert.match(detailWindowSource, /await hideHistoryPreviewDetailWindow\(\)/);
  assert.match(previewWindowSource, /listenToHistoryPreviewInvalidated/);
  assert.match(previewWindowSource, /reconcilePreviewWithInvalidation/);
});
