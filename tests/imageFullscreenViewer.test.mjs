import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

async function readSource(sourcePath) {
  return readFile(sourcePath, "utf8");
}

async function importTypeScriptModule(sourcePath) {
  const absoluteSourcePath = path.resolve(sourcePath);
  const source = await readFile(absoluteSourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: absoluteSourcePath,
  });
  const compiledPath = path.join(
    tmpdir(),
    `mclip-${path.basename(sourcePath, ".ts")}-${Date.now()}.mjs`,
  );

  await writeFile(compiledPath, output.outputText, "utf8");
  return import(compiledPath);
}

const { resolveImageDataUrl } = await importTypeScriptModule(
  "src/utils/imageDataUrl.ts",
);

test("image data URL loader reports success", async () => {
  const state = await resolveImageDataUrl(
    "/tmp/image.png",
    async () => "encoded",
    () => false,
  );

  assert.deepEqual(state, {
    src: "data:image/png;base64,encoded",
    status: "ready",
  });
});

test("image data URL loader suppresses cancelled completions", async () => {
  let resolveRead;
  let cancelled = false;
  const statePromise = resolveImageDataUrl(
    "/tmp/image.png",
    () => new Promise((resolve) => {
      resolveRead = resolve;
    }),
    () => cancelled,
  );

  cancelled = true;
  resolveRead("encoded");

  assert.equal(await statePromise, null);
});

test("image data URL loader reports failures without a broken source", async () => {
  const state = await resolveImageDataUrl(
    "/tmp/missing.png",
    async () => {
      throw new Error("missing");
    },
    () => false,
  );

  assert.deepEqual(state, { status: "error" });
});

test("image viewer window is routed, permitted, focusable, and windowed", async () => {
  const [appSource, windowSource, libSource, defaultCapability, desktopCapability] =
    await Promise.all([
      readSource("src/App.tsx"),
      readSource("src-tauri/src/window.rs"),
      readSource("src-tauri/src/lib.rs"),
      readSource("src-tauri/capabilities/default.json"),
      readSource("src-tauri/capabilities/desktop.json"),
    ]);
  const config = JSON.parse(await readSource("src-tauri/tauri.conf.json"));
  const imageViewer = config.app.windows.find(
    (windowConfig) => windowConfig.label === "image-viewer",
  );

  assert.ok(imageViewer);
  assert.equal(imageViewer.visible, false);
  assert.equal(imageViewer.fullscreen, false);
  assert.equal(imageViewer.transparent, false);
  assert.equal(imageViewer.decorations, false);
  assert.equal(imageViewer.width, 720);
  assert.equal(imageViewer.height, 520);
  assert.equal(imageViewer.resizable, true);
  assert.equal(imageViewer.maximizable, true);
  assert.equal(imageViewer.minimizable, false);
  assert.match(appSource, /windowLabel === "image-viewer"/);
  assert.match(defaultCapability, /"image-viewer"/);
  assert.match(desktopCapability, /"image-viewer"/);
  assert.match(
    windowSource,
    /for label in \[PREVIEW_WINDOW_LABEL, PREVIEW_DETAIL_WINDOW_LABEL\]/,
  );
  assert.doesNotMatch(
    windowSource,
    /for label in \[[^\]]*IMAGE_VIEWER_WINDOW_LABEL[^\]]*\]/,
  );
  assert.match(libSource, /WindowEvent::CloseRequested/);
});

test("typed image viewer IPC carries the complete image history detail", async () => {
  const [typesSource, eventsSource, commandsSource, serviceSource] =
    await Promise.all([
      readSource("src/types.ts"),
      readSource("src/services/ipc/events.ts"),
      readSource("src/services/ipc/commands.ts"),
      readSource("src/services/imageViewer.ts"),
    ]);

  assert.match(typesSource, /export type ImageViewerPayload/);
  assert.match(
    typesSource,
    /ImageViewerPayload = \{[\s\S]*item: Extract<HistoryListItem, \{ kind: "image" \}>/,
  );
  assert.match(eventsSource, /IMAGE_VIEWER_UPDATED_EVENT = "image-viewer-updated"/);
  assert.match(eventsSource, /listenToImageViewerUpdated/);
  assert.match(commandsSource, /invoke<void>\("show_image_viewer"\)/);
  assert.match(commandsSource, /invoke<void>\("close_image_viewer"\)/);
  assert.match(commandsSource, /invoke<boolean>\("toggle_image_viewer_maximize"\)/);
  assert.match(serviceSource, /toggleImageViewerMaximizeWindow/);
  assert.ok(
    serviceSource.indexOf("notifyHistoryPreviewSelectionStarted") <
      serviceSource.indexOf("updateImageViewerWindow(payload)"),
  );
  assert.ok(
    serviceSource.indexOf("updateImageViewerWindow(payload)") <
      serviceSource.indexOf("showImageViewerWindow()"),
  );
});

test("fullscreen actions are image-only in both detail shells", async () => {
  const [itemSource, detailSource, actionSource, iconSource] = await Promise.all([
    readSource("src/components/HistoryItemPreviewWindow.tsx"),
    readSource("src/components/HistoryPreviewDetailWindow.tsx"),
    readSource("src/components/HistoryDetailFullscreenButton.tsx"),
    readSource("src/components/UiIcons.tsx"),
  ]);

  assert.match(itemSource, /preview\.item\.kind === "image"/);
  assert.match(detailSource, /preview\.item\.kind === "image"/);
  assert.match(itemSource, /HistoryDetailFullscreenButton[\s\S]*HistoryDetailDeleteButton/);
  assert.match(detailSource, /HistoryDetailFullscreenButton[\s\S]*HistoryDetailDeleteButton/);
  assert.match(actionSource, /aria-label=\{label\}/);
  assert.match(actionSource, /title=\{label\}/);
  assert.match(iconSource, /export function ExpandIcon/);
  assert.match(iconSource, /m20 4-6\.5 6\.5/);
  assert.match(iconSource, /m4 20 6\.5-6\.5/);
  assert.match(detailSource, /openImageViewer\(\{[\s\S]*item: imageItem/);
  assert.match(itemSource, /onViewFullscreen/);
});

test("viewer reuses the complete history detail and keeps guarded window actions", async () => {
  const [viewerSource, panelSource, contentSource, stylesSource, i18nSource] = await Promise.all([
    readSource("src/components/FullscreenImageViewer.tsx"),
    readSource("src/components/HistoryDetailPanel.tsx"),
    readSource("src/components/HistoryPreviewDetailContent.tsx"),
    readSource("src/uiStyles.ts"),
    readSource("src/i18n.ts"),
  ]);

  assert.match(viewerSource, /useApplyAppTheme\(payload\?\.appearanceTheme/);
  assert.match(viewerSource, /HistoryDetailPanel/);
  assert.match(viewerSource, /HistoryDetailDeleteButton/);
  assert.match(viewerSource, /item=\{payload\.item\}/);
  assert.match(viewerSource, /presentation="viewer"/);
  assert.match(viewerSource, /deleteHistoryItem\(payload\.item\.id\)/);
  assert.match(viewerSource, /setIsMaximized\(true\)/);
  assert.doesNotMatch(viewerSource, /useImageDataUrl/);
  assert.doesNotMatch(viewerSource, /imageViewerToolbar/);
  assert.match(viewerSource, /event\.key !== "Escape"/);
  assert.match(viewerSource, /event\.stopPropagation\(\)/);
  assert.match(viewerSource, /isClosingRef\.current/);
  assert.match(viewerSource, /toggleImageViewerMaximize/);
  assert.match(viewerSource, /translations\.imageViewer\.restoreAriaLabel/);
  assert.match(viewerSource, /translations\.imageViewer\.maximizeAriaLabel/);
  assert.match(viewerSource, /window\.addEventListener\("keydown", handleKeyDown, true\)/);
  assert.match(viewerSource, /window\.removeEventListener\("keydown", handleKeyDown, true\)/);
  assert.match(panelSource, /presentation/);
  assert.match(contentSource, /presentation === "viewer"/);
  assert.match(stylesSource, /historyDetailImageViewer:[\s\S]*object-contain/);
  assert.match(stylesSource, /historyDetailImageViewerLoading:[\s\S]*animate-pulse/);
  assert.match(i18nSource, /viewImageFullscreenAriaLabel: "在图片查看器中打开"/);
  assert.match(i18nSource, /viewImageFullscreenAriaLabel: "Open in image viewer"/);
  assert.match(i18nSource, /maximizeAriaLabel: "最大化图片窗口"/);
  assert.match(i18nSource, /restoreAriaLabel: "恢复图片窗口"/);
  assert.match(i18nSource, /maximizeAriaLabel: "Maximize image window"/);
  assert.match(i18nSource, /restoreAriaLabel: "Restore image window"/);
});

test("native viewer toggles maximize without changing preview focus ownership", async () => {
  const [windowSource, libSource] = await Promise.all([
    readSource("src-tauri/src/window.rs"),
    readSource("src-tauri/src/lib.rs"),
  ]);

  assert.match(windowSource, /pub fn toggle_image_viewer_maximize/);
  assert.match(windowSource, /viewer\.is_maximized\(\)/);
  assert.match(windowSource, /viewer\.maximize\(\)/);
  assert.match(windowSource, /viewer\.unmaximize\(\)/);
  assert.doesNotMatch(windowSource, /set_simple_fullscreen\(true\)/);
  assert.match(
    windowSource,
    /for label in \[PREVIEW_WINDOW_LABEL, PREVIEW_DETAIL_WINDOW_LABEL\]/,
  );
  assert.match(libSource, /toggle_image_viewer_maximize/);
});

test("normal image details expose compact loading and error fallbacks only", async () => {
  const [contentSource, imageSource, stylesSource, i18nSource] = await Promise.all([
    readSource("src/components/HistoryPreviewDetailContent.tsx"),
    readSource("src/components/ImageThumb.tsx"),
    readSource("src/uiStyles.ts"),
    readSource("src/i18n.ts"),
  ]);

  assert.match(imageSource, /loadingFallback\?: ReactNode/);
  assert.match(imageSource, /errorFallback\?: ReactNode/);
  assert.match(contentSource, /loadingFallback=/);
  assert.match(contentSource, /errorFallback=/);
  assert.match(stylesSource, /historyDetailImageLoading:/);
  assert.match(stylesSource, /historyDetailImageError:/);
  assert.match(i18nSource, /imageLoading:/);
  assert.match(i18nSource, /imageLoadError:/);
});

test("Rust viewer lifecycle opens maximized while preserving the main window", async () => {
  const [source, libSource] = await Promise.all([
    readSource("src-tauri/src/window.rs"),
    readSource("src-tauri/src/lib.rs"),
  ]);
  const showViewerSource = source.slice(
    source.indexOf("pub fn show_image_viewer"),
    source.indexOf("pub fn close_image_viewer"),
  );

  assert.match(source, /pub fn show_image_viewer/);
  assert.match(source, /main_window[\s\S]*current_monitor\(\)/);
  assert.match(source, /fn set_image_viewer_windowed_frame/);
  assert.match(source, /IMAGE_VIEWER_DEFAULT_WIDTH: f64 = 720\.0/);
  assert.match(source, /IMAGE_VIEWER_DEFAULT_HEIGHT: f64 = 520\.0/);
  assert.match(source, /set_position\(Position::Physical\(PhysicalPosition::new\(x, y\)\)\)/);
  assert.match(source, /set_size\(Size::Physical\(PhysicalSize::new\(width, height\)\)\)/);
  assert.match(showViewerSource, /hide_history_preview_window\(app_handle\.clone\(\)\)\?/);
  assert.match(
    source,
    /pub fn hide_history_preview_window[\s\S]*hide_history_preview_detail_window\(app_handle\)/,
  );
  assert.doesNotMatch(showViewerSource, /hide_main_window/);
  assert.match(showViewerSource, /set_focusable\(true\)/);
  assert.match(source, /set_decorations\(false\)/);
  assert.match(source, /set_shadow\(true\)/);
  assert.doesNotMatch(source, /set_simple_fullscreen\(true\)/);
  assert.ok(
    showViewerSource.indexOf("set_image_viewer_windowed_frame") <
      showViewerSource.indexOf("viewer.show()"),
  );
  assert.ok(
    showViewerSource.indexOf("viewer.show()") <
      showViewerSource.indexOf("viewer.maximize()"),
  );
  assert.match(
    showViewerSource,
    /set_main_window_always_on_top\(&app_handle, false\)/,
  );
  assert.match(
    source,
    /if let Err\(error\) = show_result[\s\S]*set_main_window_always_on_top\(&app_handle, true\)/,
  );
  assert.match(source, /#\[cfg\(target_os = "macos"\)\][\s\S]*fn reinforce_image_viewer_focus/);
  assert.match(source, /for delay_ms in \[50, 100, 200\]/);
  assert.match(source, /!viewer\.is_visible\(\)\.unwrap_or\(false\)/);
  assert.doesNotMatch(source, /viewer\.is_focused\(\)\.unwrap_or\(false\)/);
  assert.match(source, /fn focus_image_viewer/);
  assert.match(source, /viewer\.set_focus\(\)/);
  assert.match(
    source,
    /#\[cfg\(target_os = "macos"\)\][\s\S]*viewer[\s\S]*\.as_ref\(\)[\s\S]*\.set_focus\(\)/,
  );
  assert.match(source, /let _ = focus_image_viewer\(&viewer\)/);
  assert.match(showViewerSource, /reinforce_image_viewer_focus\(viewer\)/);
  assert.match(source, /pub fn close_image_viewer/);
  assert.match(source, /IMAGE_VIEWER_CLOSE_IN_PROGRESS\.swap\(true, Ordering::AcqRel\)/);
  assert.match(source, /viewer\.unmaximize\(\)/);
  assert.match(
    source,
    /pub fn close_image_viewer[\s\S]*set_main_window_always_on_top\(&app_handle, true\)[\s\S]*show_main_window_in_place\(&app_handle\)/,
  );
  assert.match(source, /show_main_window_in_place\(&app_handle\)/);
  assert.match(
    source,
    /show_main_window_in_place[\s\S]*emit\(MAIN_WINDOW_SHOWN_EVENT, \(\)\)/,
  );
  assert.match(source, /pub fn is_image_viewer_visible/);
  assert.match(libSource, /should_hide_main_window_on_focus_loss/);
  assert.match(libSource, /is_image_viewer_visible\(window\.app_handle\(\)\)/);
  assert.match(
    libSource,
    /should_hide_main_window_on_focus_loss\([\s\S]*is_image_viewer_visible/,
  );
});
