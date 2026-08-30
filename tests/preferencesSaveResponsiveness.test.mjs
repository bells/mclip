import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readPreferencesSource() {
  return readFile("src/components/PreferencesWindow.tsx", "utf8");
}

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);

  assert.notEqual(start, -1, startMarker + " should exist");
  assert.notEqual(end, -1, endMarker + " should exist after " + startMarker);

  return source.slice(start, end);
}

test("settings saves are queued in the background instead of disabling the page", async () => {
  const [source, controllerSource] = await Promise.all([
    readPreferencesSource(),
    readFile("src/components/preferences/preferenceSaveController.ts", "utf8"),
  ]);

  assert.match(source, /createPreferenceSaveController/);
  assert.match(controllerSource, /let saveQueue = Promise\.resolve\(\)/);
  assert.match(controllerSource, /const saveTask = saveQueue\.then\(async \(\) =>/);
  assert.match(controllerSource, /saveQueue = saveTask/);
  assert.match(controllerSource, /pendingCount \+= 1/);
  assert.doesNotMatch(source, /isSavingSettings/);
  assert.doesNotMatch(source, /setIsSavingSettings/);
  assert.match(source, /feedbackLabels=\{\{/);
});

test("storage controls stay interactive while settings persist", async () => {
  const source = await readPreferencesSource();
  const storagePanel = sourceBetween(
    source,
    "history: (",
    "privacy: (",
  );

  assert.doesNotMatch(storagePanel, /disabled=\{isSavingSettings/);
  assert.match(
    storagePanel,
    /onChange=\{\(event\) => updateMaxHistoryCountInput\(event\.target\.value\)\}/,
  );
  assert.doesNotMatch(storagePanel, /className=\{ui\.stepperButton\}/);
  assert.match(storagePanel, /onClick=\{\(\) => toggleHistoryType\(kind\)\}/);
});

test("history type choices render as one compact row", async () => {
  const stylesSource = await readFile("src/uiStyles.ts", "utf8");
  const historyTypeStyles = stylesSource.slice(
    stylesSource.indexOf("historyTypesSection:"),
    stylesSource.indexOf("cliInstallSection:"),
  );
  const historyTypeRowSource = stylesSource.slice(
    stylesSource.indexOf("export function historyTypeRow"),
  );

  assert.match(historyTypeStyles, /historyTypesSection:[\s\S]*grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(historyTypeStyles, /historyTypeList:[\s\S]*grid-cols-3/);
  assert.match(historyTypeRowSource, /border-r border-\[var\(--mclip-line\)\]/);
  assert.doesNotMatch(historyTypeStyles, /max-w-\[220px\]/);
});
