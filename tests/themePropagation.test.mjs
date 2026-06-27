import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("main dialog and preview windows apply the shared app theme hook", async () => {
  const [appSource, aboutSource, preferencesSource, previewSource, detailSource] =
    await Promise.all([
      readSource("src/App.tsx"),
      readSource("src/components/AboutWindow.tsx"),
      readSource("src/components/PreferencesWindow.tsx"),
      readSource("src/components/HistoryPreviewWindow.tsx"),
      readSource("src/components/HistoryPreviewDetailWindow.tsx"),
    ]);

  assert.match(appSource, /useApplyAppTheme\(settings\.appearanceTheme\)/);
  assert.match(aboutSource, /useApplyAppTheme\(settings\.appearanceTheme\)/);
  assert.match(preferencesSource, /useApplyAppTheme\(settingsDraft\.appearanceTheme\)/);
  assert.match(previewSource, /useApplyAppTheme\(preview\?\.appearanceTheme \?\? "system"\)/);
  assert.match(detailSource, /useApplyAppTheme\(preview\?\.appearanceTheme \?\? "system"\)/);
});

test("history preview payloads carry appearance theme across Tauri windows", async () => {
  const [typesSource, controllerSource] = await Promise.all([
    readSource("src/types.ts"),
    readSource("src/hooks/useHistoryPreviewController.ts"),
  ]);

  assert.match(typesSource, /appearanceTheme: AppearanceTheme/);
  assert.match(controllerSource, /appearanceTheme: settings\.appearanceTheme/);
  assert.match(controllerSource, /settings\.appearanceTheme/);
});
