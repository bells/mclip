import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("history synchronization uses a snapshot, main-only deltas, and preview invalidation", async () => {
  const [rustSource, commandsSource, eventsSource, controllerSource, previewSource] =
    await Promise.all([
      readFile("src-tauri/src/history.rs", "utf8"),
      readFile("src/services/ipc/commands.ts", "utf8"),
      readFile("src/services/ipc/events.ts", "utf8"),
      readFile("src/hooks/useClipboardDataController.ts", "utf8"),
      readFile("src/components/HistoryPreviewWindow.tsx", "utf8"),
    ]);

  assert.match(rustSource, /emit_to\(MAIN_WINDOW_LABEL, HISTORY_CHANGED_EVENT, change\)/);
  assert.match(rustSource, /HISTORY_PREVIEW_INVALIDATED_EVENT/);
  assert.doesNotMatch(rustSource, /history-updated|HISTORY_UPDATED_EVENT/);
  assert.match(commandsSource, /invoke<HistorySnapshot>\("get_history_snapshot"\)/);
  assert.match(eventsSource, /listen<HistoryChange>\(HISTORY_CHANGED_EVENT/);
  assert.match(controllerSource, /reduceHistoryChange\(historySnapshotRef\.current, change\)/);
  assert.match(controllerSource, /status === "needsReplace"/);
  assert.match(previewSource, /listenToHistoryPreviewInvalidated/);
  assert.doesNotMatch(previewSource, /HistoryEntry\[\]|listenToHistoryChanged/);
});

test("unrelated auxiliary windows do not subscribe to history deltas", async () => {
  const sources = await Promise.all(
    [
      "src/components/AboutWindow.tsx",
      "src/components/PreferencesWindow.tsx",
      "src/components/FullscreenImageViewer.tsx",
    ].map((path) => readFile(path, "utf8")),
  );

  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /listenToHistoryChanged|listenToHistoryPreviewInvalidated|history-updated/,
    );
  }
});
