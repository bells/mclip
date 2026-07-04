import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("about and preferences windows use the shared status bar frame", async () => {
  const [aboutSource, preferencesSource] = await Promise.all([
    readSource("src/components/AboutWindow.tsx"),
    readSource("src/components/PreferencesWindow.tsx"),
  ]);

  assert.match(aboutSource, /import \{ DialogWindowFrame \} from "\.\/DialogWindowFrame";/);
  assert.match(preferencesSource, /import \{ DialogWindowFrame \} from "\.\/DialogWindowFrame";/);
  assert.match(aboutSource, /import \{ DialogStatusBar \} from "\.\/DialogStatusBar";/);
  assert.match(preferencesSource, /import \{ DialogStatusBar \} from "\.\/DialogStatusBar";/);
  assert.match(aboutSource, /<DialogWindowFrame className=\{ui\.aboutWindowFrame\}>/);
  assert.match(preferencesSource, /<DialogWindowFrame className=\{ui\.preferencesWindowFrame\}>/);
  assert.match(aboutSource, /<DialogStatusBar/);
  assert.match(preferencesSource, /<DialogStatusBar/);
  assert.doesNotMatch(aboutSource, /app-dialog-frame app-about-window/);
  assert.doesNotMatch(preferencesSource, /app-dialog-frame app-preferences-window/);
});

test("dialog drag frame starts dragging only from explicit status bar targets", async () => {
  const frameSource = await readSource("src/components/DialogWindowFrame.tsx");
  const dragSource = await readSource("src/utils/dialogDrag.ts");
  const tauriFacadeSource = await readSource("src/lib/tauri.ts");
  const windowServiceSource = await readSource("src/services/ipc/windows.ts");

  assert.match(frameSource, /event\.button !== 0/);
  assert.match(frameSource, /shouldStartDialogWindowDrag\(event\.target\)/);
  assert.match(frameSource, /startCurrentWindowDrag\(\)/);
  assert.match(dragSource, /\[data-dialog-drag-region\]/);
  assert.match(dragSource, /closest\("\[data-dialog-drag-region\]"\)/);
  assert.match(dragSource, /button/);
  assert.match(dragSource, /input/);
  assert.match(dragSource, /select/);
  assert.match(dragSource, /textarea/);
  assert.match(dragSource, /\[data-dialog-drag-exclude\]/);
  assert.match(windowServiceSource, /export function startCurrentWindowDrag\(\)/);
  assert.match(windowServiceSource, /getCurrentWindow\(\)\.startDragging\(\)/);
  assert.match(tauriFacadeSource, /export \* from "\.\.\/services\/ipc\/windows";/);
});

test("dialog status bar keeps native-style title and control layout", async () => {
  const [statusBarSource, controlsSource, stylesCss, stylesSource] = await Promise.all([
    readSource("src/components/DialogStatusBar.tsx"),
    readSource("src/components/DialogWindowControls.tsx"),
    readSource("src/styles.css"),
    readSource("src/uiStyles.ts"),
  ]);

  assert.match(statusBarSource, /getPreferredWindowControlSide/);
  assert.match(statusBarSource, /ui\.dialogStatusBar\(controlSide\)/);
  assert.match(controlsSource, /data-dialog-drag-exclude/);
  assert.match(stylesCss, /--mclip-titlebar-bg/);
  assert.match(stylesSource, /dialogStatusBar\(controlSide: WindowControlSide\)/);
  assert.match(stylesSource, /controlSide === "left"/);
  assert.match(stylesSource, /controlSide === "right"/);
  assert.doesNotMatch(stylesCss, /dialog-statusbar::after/);
});
