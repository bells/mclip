import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

async function readSource(sourcePath) {
  return readFile(path.resolve(sourcePath), "utf8");
}

async function importUtility() {
  const sourcePath = path.resolve("src/utils/textQuickActions.ts");
  const source = await readFile(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  });
  const compiledPath = path.join(
    tmpdir(),
    `mclip-text-quick-actions-${Date.now()}.mjs`,
  );
  await writeFile(compiledPath, output.outputText, "utf8");
  return import(compiledPath);
}

const quickActions = await importUtility();

test("quick actions use symmetric byte limits and compact independent sizing", () => {
  assert.equal(quickActions.MAX_TEXT_TRANSFORM_INPUT_BYTES, 1024 * 1024);
  assert.equal(quickActions.MAX_TEXT_TRANSFORM_OUTPUT_BYTES, 4 * 1024 * 1024);
  assert.deepEqual(quickActions.QUICK_ACTION_WINDOW_SIZE, {
    height: 420,
    width: 560,
  });
  assert.equal(quickActions.TEXT_TRANSFORM_ACTIONS.length, 6);
});

test("stale action results are rejected after item or request changes", () => {
  assert.equal(
    quickActions.isCurrentQuickActionRequest("item", "item", 3, 3),
    true,
  );
  assert.equal(
    quickActions.isCurrentQuickActionRequest("next", "item", 3, 3),
    false,
  );
  assert.equal(
    quickActions.isCurrentQuickActionRequest("item", "item", 4, 3),
    false,
  );
});

test("desktop action groups filter independently without changing the action set", () => {
  assert.equal(
    quickActions.TEXT_QUICK_ACTION_GROUP_BY_ACTION.jsonPrettify,
    "json",
  );
  assert.equal(
    quickActions.TEXT_QUICK_ACTION_GROUP_BY_ACTION.base64Decode,
    "base64",
  );
  assert.equal(
    quickActions.TEXT_QUICK_ACTION_GROUP_BY_ACTION.urlComponentEncode,
    "urlComponent",
  );
  assert.deepEqual(
    quickActions.filterEnabledTextQuickActions(
      quickActions.TEXT_TRANSFORM_ACTIONS,
      { base64: false, json: true, urlComponent: false },
    ),
    ["jsonPrettify", "jsonMinify"],
  );
  assert.equal(
    quickActions.hasEnabledTextQuickActions({
      base64: false,
      json: false,
      urlComponent: false,
    }),
    false,
  );
});

test("detail applicability is bounded and never runs from list or hover renderers", async () => {
  const [actionsSource, listSource, groupSource] = await Promise.all([
    readSource("src/components/TextQuickActions.tsx"),
    readSource("src/components/HistoryList.tsx"),
    readSource("src/components/HistoryGroupPreviewWindow.tsx"),
  ]);
  assert.match(actionsSource, /getApplicableTextTransformActions/);
  assert.match(actionsSource, /!hasEnabledTextQuickActions\(settings\)/);
  assert.match(actionsSource, /filterEnabledTextQuickActions/);
  assert.match(actionsSource, /requestRevisionRef/);
  assert.doesNotMatch(listSource, /transformText|TextQuickActions/);
  assert.doesNotMatch(groupSource, /transformText|TextQuickActions/);
});

test("result window keeps copy replace and cancel as separate explicit flows", async () => {
  const [windowSource, serviceSource, descriptorSource] = await Promise.all([
    readSource("src/components/QuickActionWindow.tsx"),
    readSource("src/services/quickActions.ts"),
    readSource("src-tauri/src/auxiliary_window_contract.rs"),
  ]);
  assert.match(windowSource, /copyTextToClipboard\(payload\.output\)/);
  assert.match(windowSource, /replaceHistoryText\(payload\.targetId, payload\.output\)/);
  assert.match(windowSource, /setIsConfirmingReplace\(true\)/);
  assert.match(windowSource, /discardAndHide/);
  assert.match(windowSource, /event\.key !== "Escape"/);
  assert.ok(
    serviceSource.indexOf("await transformText") <
      serviceSource.indexOf('ensureAuxiliaryWindowReady("quick-action")'),
  );
  assert.match(descriptorSource, /label: "quick-action"/);
  assert.match(descriptorSource, /label: "preview"[\s\S]*?focusable: false/);
  const quickActionDescriptorSource = descriptorSource.slice(
    descriptorSource.indexOf('label: "quick-action"'),
    descriptorSource.indexOf('label: "preferences"'),
  );
  assert.match(quickActionDescriptorSource, /always_on_top: true/);
});
