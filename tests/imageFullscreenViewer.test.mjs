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

test("image viewer window is routed, permitted, and focusable", async () => {
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
  assert.equal(imageViewer.resizable, false);
  assert.equal(imageViewer.maximizable, false);
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

test("typed image viewer IPC keeps events and window commands separate", async () => {
  const [typesSource, eventsSource, commandsSource, serviceSource] =
    await Promise.all([
      readSource("src/types.ts"),
      readSource("src/services/ipc/events.ts"),
      readSource("src/services/ipc/commands.ts"),
      readSource("src/services/imageViewer.ts"),
    ]);

  assert.match(typesSource, /export type ImageViewerPayload/);
  assert.match(typesSource, /imagePath: string/);
  assert.match(eventsSource, /IMAGE_VIEWER_UPDATED_EVENT = "image-viewer-updated"/);
  assert.match(eventsSource, /listenToImageViewerUpdated/);
  assert.match(commandsSource, /invoke<void>\("show_image_viewer"\)/);
  assert.match(commandsSource, /invoke<void>\("close_image_viewer"\)/);
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
});

test("fullscreen surface has complete states and guarded keyboard close", async () => {
  const [viewerSource, hookSource, stylesSource, i18nSource] = await Promise.all([
    readSource("src/components/FullscreenImageViewer.tsx"),
    readSource("src/hooks/useImageDataUrl.ts"),
    readSource("src/uiStyles.ts"),
    readSource("src/i18n.ts"),
  ]);

  assert.match(viewerSource, /useApplyAppTheme\(payload\?\.appearanceTheme/);
  assert.match(viewerSource, /image\.status === "ready"/);
  assert.match(viewerSource, /image\.status === "error"/);
  assert.match(viewerSource, /event\.key !== "Escape"/);
  assert.match(viewerSource, /event\.stopPropagation\(\)/);
  assert.match(viewerSource, /isClosingRef\.current/);
  assert.match(viewerSource, /window\.addEventListener\("keydown", handleKeyDown, true\)/);
  assert.match(viewerSource, /window\.removeEventListener\("keydown", handleKeyDown, true\)/);
  assert.match(hookSource, /cancelled = true/);
  assert.match(stylesSource, /imageViewerImage:[\s\S]*object-contain/);
  assert.match(stylesSource, /imageViewerSkeleton:[\s\S]*animate-pulse/);
  assert.match(i18nSource, /viewImageFullscreenAriaLabel: "全屏查看图片"/);
  assert.match(i18nSource, /viewImageFullscreenAriaLabel: "View image fullscreen"/);
  assert.match(i18nSource, /loadError: "无法加载这张图片。"/);
  assert.match(i18nSource, /loadError: "Unable to load this image\."/);
});

test("Rust viewer lifecycle hides previews and restores main in place", async () => {
  const source = await readSource("src-tauri/src/window.rs");
  const showViewerSource = source.slice(
    source.indexOf("pub fn show_image_viewer"),
    source.indexOf("pub fn close_image_viewer"),
  );

  assert.match(source, /pub fn show_image_viewer/);
  assert.match(source, /main_window[\s\S]*current_monitor\(\)/);
  assert.match(source, /fn set_window_to_monitor_frame/);
  assert.match(source, /set_position\(Position::Physical\(\*monitor\.position\(\)\)\)/);
  assert.match(source, /set_size\(Size::Physical\(\*monitor\.size\(\)\)\)/);
  assert.match(source, /hide_main_window\(&app_handle\)\?/);
  assert.match(showViewerSource, /set_focusable\(true\)/);
  assert.match(source, /set_decorations\(false\)/);
  assert.match(source, /set_shadow\(false\)/);
  assert.match(source, /set_simple_fullscreen\(true\)/);
  assert.ok(
    showViewerSource.indexOf("viewer.show()") <
      showViewerSource.indexOf("set_simple_fullscreen(true)"),
  );
  assert.equal(
    showViewerSource.match(/set_window_to_monitor_frame\(&viewer, &target_monitor\)/g)
      ?.length,
    2,
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
  assert.match(source, /set_simple_fullscreen\(false\)/);
  assert.match(source, /show_main_window_in_place\(&app_handle\)/);
  assert.match(
    source,
    /show_main_window_in_place[\s\S]*emit\(MAIN_WINDOW_SHOWN_EVENT, \(\)\)/,
  );
});
