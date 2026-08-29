import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("only main is configured at startup while fixed auxiliary labels retain capabilities", async () => {
  const [configSource, defaultCapabilitySource, desktopCapabilitySource] = await Promise.all([
    readSource("src-tauri/tauri.conf.json"),
    readSource("src-tauri/capabilities/default.json"),
    readSource("src-tauri/capabilities/desktop.json"),
  ]);
  const config = JSON.parse(configSource);
  const defaultCapability = JSON.parse(defaultCapabilitySource);
  const desktopCapability = JSON.parse(desktopCapabilitySource);
  const auxiliaryLabels = [
    "preview",
    "preview-detail",
    "image-viewer",
    "about",
    "quick-action",
    "preferences",
  ];

  assert.deepEqual(config.app.windows.map((window) => window.label ?? "main"), ["main"]);
  for (const label of auxiliaryLabels) {
    assert.ok(defaultCapability.windows.includes(label));
    assert.ok(desktopCapability.windows.includes(label));
  }
});

test("typed ready handshake includes generation, timeout recovery, and dynamic URL", async () => {
  const [rustSource, commandSource, serviceSource, typesSource] = await Promise.all([
    readSource("src-tauri/src/auxiliary_windows.rs"),
    readSource("src/services/ipc/commands.ts"),
    readSource("src/services/auxiliaryWindows.ts"),
    readSource("src/types.ts"),
  ]);

  assert.match(typesSource, /export type AuxiliaryWindowLabel/);
  assert.match(commandSource, /invoke<number>\("ensure_auxiliary_window", \{ label \}\)/);
  assert.match(commandSource, /invoke<boolean>\("mark_auxiliary_window_ready", \{ generation \}\)/);
  assert.match(rustSource, /mclipWindowGeneration=\{generation\}/);
  assert.match(rustSource, /AUXILIARY_READY_TIMEOUT/);
  assert.match(rustSource, /spawn_blocking/);
  assert.match(rustSource, /window\.destroy\(\)/);
  assert.match(serviceSource, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(serviceSource, /expectedListenerTokens/);
});

test("payload listeners acknowledge ready before producers emit to dynamic routes", async () => {
  const [previewSource, detailSource, viewerSource, aboutSource, quickActionSource, preferencesSource, controllerSource, imageServiceSource, quickActionServiceSource] =
    await Promise.all([
      readSource("src/components/HistoryPreviewWindow.tsx"),
      readSource("src/components/HistoryPreviewDetailWindow.tsx"),
      readSource("src/components/FullscreenImageViewer.tsx"),
      readSource("src/components/AboutWindow.tsx"),
      readSource("src/components/QuickActionWindow.tsx"),
      readSource("src/components/PreferencesWindow.tsx"),
      readSource("src/hooks/useHistoryPreviewController.ts"),
      readSource("src/services/imageViewer.ts"),
      readSource("src/services/quickActions.ts"),
    ]);

  for (const [source, token] of [
    [previewSource, "historyPreviewUpdated"],
    [previewSource, "historyPreviewInvalidated"],
    [previewSource, "keyboardNavigation"],
    [previewSource, "performanceAutomation"],
    [detailSource, "previewDetailUpdated"],
    [detailSource, "placementUpdated"],
    [viewerSource, "imageViewerUpdated"],
    [aboutSource, "settingsUpdated"],
    [quickActionSource, "quickActionUpdated"],
    [preferencesSource, "settingsUpdated"],
  ]) {
    assert.match(source, new RegExp(`reportAuxiliaryListenerReady\\("${token}"\\)`));
  }

  assert.ok(
    controllerSource.indexOf('ensureAuxiliaryWindowReady("preview")') <
      controllerSource.indexOf("await updateHistoryPreviewWindow({"),
  );
  assert.ok(
    previewSource.indexOf('ensureAuxiliaryWindowReady("preview-detail")') <
      previewSource.indexOf("updateHistoryPreviewDetailWindow({"),
  );
  assert.ok(
    imageServiceSource.indexOf('ensureAuxiliaryWindowReady("image-viewer")') <
      imageServiceSource.indexOf("updateImageViewerWindow(measuredPayload)"),
  );
  assert.ok(
    quickActionServiceSource.indexOf('ensureAuxiliaryWindowReady("quick-action")') <
      quickActionServiceSource.indexOf("updateQuickActionWindow({"),
  );
});
