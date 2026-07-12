import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("group preview reports rendered natural height to the main controller", async () => {
  const [groupSource, controllerSource, commandSource, eventSource] = await Promise.all([
    readSource("src/components/HistoryGroupPreviewWindow.tsx"),
    readSource("src/hooks/useHistoryPreviewController.ts"),
    readSource("src/services/ipc/commands.ts"),
    readSource("src/services/ipc/events.ts"),
  ]);

  assert.match(groupSource, /list\.scrollHeight/);
  assert.match(groupSource, /new ResizeObserver\(reportNaturalHeight\)/);
  assert.match(groupSource, /reportHistoryPreviewMeasured/);
  assert.match(eventSource, /HISTORY_PREVIEW_MEASURED_EVENT/);
  assert.match(controllerSource, /listenToHistoryPreviewMeasured/);
  assert.match(commandSource, /"resize_history_preview_window"/);
  assert.match(
    controllerSource,
    /const previewHeight = getGroupPreviewHeight\(previewHistory\.length\)/,
  );
  assert.match(
    controllerSource,
    /resizeHistoryPreviewWindow\(measuredGroupPreview\.height\)/,
  );
  assert.doesNotMatch(
    controllerSource,
    /const previewHeight\s*=\s*measuredGroupPreview/,
  );
  const fallbackHeightStart = controllerSource.indexOf(
    "const previewHeight = getGroupPreviewHeight",
  );
  const groupShowStart = controllerSource.lastIndexOf(
    "const previewGroup = historyGroups.find",
    fallbackHeightStart,
  );
  const measuredResizeEffectStart = controllerSource.indexOf(
    "previewWindowSide === null",
    groupShowStart,
  );
  assert.notEqual(groupShowStart, -1);
  assert.notEqual(fallbackHeightStart, -1);
  assert.notEqual(measuredResizeEffectStart, -1);
  assert.doesNotMatch(
    controllerSource.slice(groupShowStart, measuredResizeEffectStart),
    /measuredGroupPreview/,
  );
  assert.match(controllerSource, /previewWindowSide === null/);
  assert.match(
    controllerSource,
    /measuredGroupPreview\?\.groupIndex !== previewHistoryGroupIndex/,
  );
  assert.match(controllerSource, /canCompletePreviewOpenRequest/);
  assert.match(controllerSource, /activePreviewTargetRef\.current === target/);
});

test("group preview keeps a fixed header and scrollable list when clamped", async () => {
  const stylesSource = await readSource("src/uiStyles.ts");

  assert.match(stylesSource, /historyPreviewHeader:[\s\S]*shrink-0/);
  assert.match(stylesSource, /historyGroupPreviewBody: "min-h-0 flex-1 overflow-hidden"/);
  assert.match(stylesSource, /historyPreviewList:[\s\S]*overflow-y-auto/);
  assert.doesNotMatch(stylesSource, /--group-preview-height/);
});
