import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("group items update and show the independent preview-detail window", async () => {
  const [previewSource, commandsSource, eventsSource] = await Promise.all([
    readSource("src/components/HistoryPreviewWindow.tsx"),
    readSource("src/services/ipc/commands.ts"),
    readSource("src/services/ipc/events.ts"),
  ]);

  assert.match(previewSource, /detailUpdateQueueRef/);
  assert.match(previewSource, /updateHistoryPreviewDetailWindow/);
  assert.match(previewSource, /showHistoryPreviewDetailWindow/);
  assert.match(previewSource, /notifyHistoryPreviewPlacementUpdated\(placement\.group\)/);
  assert.match(previewSource, /getItemPreviewHeight\(requestedItem\)/);
  assert.match(previewSource, /hoveredItemIdRef\.current !== requestedItem\.id/);
  assert.match(eventsSource, /PREVIEW_DETAIL_WINDOW_LABEL/);
  assert.match(commandsSource, /PreviewFamilyPosition/);
  assert.doesNotMatch(commandsSource, /show_history_group_preview_with_detail_window/);
});

test("group list no longer embeds a detail panel", async () => {
  const [groupSource, previewSource] = await Promise.all([
    readSource("src/components/HistoryGroupPreviewWindow.tsx"),
    readSource("src/components/HistoryPreviewWindow.tsx"),
  ]);

  assert.doesNotMatch(groupSource, /HistoryDetailPanel/);
  assert.doesNotMatch(groupSource, /detailOffset|detailPreviewHeight|detailSide/);
  assert.doesNotMatch(previewSource, /getGroupPreviewHeightWithDetail/);
  assert.doesNotMatch(previewSource, /showHistoryGroupPreviewWithDetailWindow/);
});

test("pointer hit testing keeps both preview windows in one family", async () => {
  const windowSource = await readSource("src-tauri/src/window.rs");

  assert.match(
    windowSource,
    /is_pointer_over_window\(app_handle, PREVIEW_WINDOW_LABEL\)\?[\s\S]*is_pointer_over_window\(app_handle, PREVIEW_DETAIL_WINDOW_LABEL\)\?/,
  );
});
