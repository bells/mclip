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
  assert.match(previewSource, /getGroupPreviewItemAnchorTop\(requestedItem\.id\)/);
  assert.match(previewSource, /getBoundingClientRect\(\)\.top/);
  assert.match(
    previewSource,
    /showHistoryPreviewDetailWindow\(\s*detailAnchorTop,/,
  );
  assert.match(previewSource, /hoveredItemIdRef\.current !== requestedItem\.id/);
  assert.match(eventsSource, /PREVIEW_DETAIL_WINDOW_LABEL/);
  assert.match(eventsSource, /HISTORY_PREVIEW_DETAIL_UPDATED_EVENT/);
  assert.match(
    eventsSource,
    /PREVIEW_DETAIL_WINDOW_LABEL,[\s\S]*HISTORY_PREVIEW_DETAIL_UPDATED_EVENT/,
  );
  assert.match(commandsSource, /PreviewFamilyPosition/);
  assert.match(commandsSource, /detailAnchorTop/);
  assert.doesNotMatch(commandsSource, /show_history_group_preview_with_detail_window/);
});

test("archive detail uses the main detail width without an internal window gap", async () => {
  const [constantsSource, detailSource] = await Promise.all([
    readSource("src/constants.ts"),
    readSource("src/components/HistoryPreviewDetailWindow.tsx"),
  ]);

  assert.match(
    constantsSource,
    /GROUP_PREVIEW_DETAIL_WINDOW_WIDTH = ITEM_PREVIEW_WIDTH/,
  );
  assert.doesNotMatch(detailSource, /\b(?:pl|pr)-2\b/);
});

test("group and detail windows cannot consume each other's payload events", async () => {
  const [eventsSource, detailSource] = await Promise.all([
    readSource("src/services/ipc/events.ts"),
    readSource("src/components/HistoryPreviewDetailWindow.tsx"),
  ]);

  assert.match(eventsSource, /history-preview-updated/);
  assert.match(eventsSource, /history-preview-detail-updated/);
  assert.match(detailSource, /listenToHistoryPreviewDetailUpdated/);
  assert.doesNotMatch(detailSource, /listenToHistoryPreviewUpdated/);
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

test("detail sizing and placement share the group monitor physical coordinate space", async () => {
  const [windowSource, cargoSource] = await Promise.all([
    readSource("src-tauri/src/window.rs"),
    readSource("src-tauri/Cargo.toml"),
  ]);

  assert.match(windowSource, /let preview_scale_factor = preview_window/);
  assert.match(windowSource, /set_size\(Size::Physical\(PhysicalSize/);
  assert.match(windowSource, /set_position\(Position::Physical\(PhysicalPosition/);
  assert.doesNotMatch(windowSource, /align_preview_detail_x|detail_ns_window\.frame/);
  assert.doesNotMatch(cargoSource, /objc2-app-kit/);
});
