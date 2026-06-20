import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("about and preferences windows use the draggable dialog frame", async () => {
  const [aboutSource, preferencesSource] = await Promise.all([
    readSource("src/components/AboutWindow.tsx"),
    readSource("src/components/PreferencesWindow.tsx"),
  ]);

  assert.match(aboutSource, /import \{ DialogWindowFrame \} from "\.\/DialogWindowFrame";/);
  assert.match(preferencesSource, /import \{ DialogWindowFrame \} from "\.\/DialogWindowFrame";/);
  assert.match(aboutSource, /<DialogWindowFrame className="app-about-window">/);
  assert.match(preferencesSource, /<DialogWindowFrame className="app-preferences-window">/);
  assert.doesNotMatch(aboutSource, /<div className="app-dialog-frame app-about-window">/);
  assert.doesNotMatch(
    preferencesSource,
    /<div className="app-dialog-frame app-preferences-window">/,
  );
});

test("dialog drag frame starts dragging only from non-interactive targets", async () => {
  const frameSource = await readSource("src/components/DialogWindowFrame.tsx");
  const dragSource = await readSource("src/utils/dialogDrag.ts");
  const tauriFacadeSource = await readSource("src/lib/tauri.ts");
  const windowServiceSource = await readSource("src/services/ipc/windows.ts");

  assert.match(frameSource, /event\.button !== 0/);
  assert.match(frameSource, /shouldStartDialogWindowDrag\(event\.target\)/);
  assert.match(frameSource, /startCurrentWindowDrag\(\)/);
  assert.match(dragSource, /button/);
  assert.match(dragSource, /input/);
  assert.match(dragSource, /select/);
  assert.match(dragSource, /textarea/);
  assert.match(dragSource, /\[data-dialog-drag-exclude\]/);
  assert.match(windowServiceSource, /export function startCurrentWindowDrag\(\)/);
  assert.match(windowServiceSource, /getCurrentWindow\(\)\.startDragging\(\)/);
  assert.match(tauriFacadeSource, /export \* from "\.\.\/services\/ipc\/windows";/);
});
