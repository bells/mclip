import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

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

const { reconcilePreviewWithHistoryIds } = await importTypeScriptModule(
  "src/utils/previewHistory.ts",
);

function createItem(id, position) {
  return {
    copyCount: 1,
    displayText: id,
    firstCopiedAt: 1,
    id,
    kind: "text",
    lastCopiedAt: 1,
    position,
    renderId: id,
    sourceApp: null,
    text: id,
  };
}

function createGroupPreview(items) {
  return {
    appearanceTheme: "system",
    autoPaste: false,
    group: { endPosition: 20, index: 0, label: "11 - 20", startPosition: 11 },
    items,
    kind: "group",
    language: "system",
    showHistoryItemNumbers: true,
  };
}

test("deleting an active archive item refreshes the remaining group", () => {
  const first = createItem("first", 11);
  const second = createItem("second", 12);
  const result = reconcilePreviewWithHistoryIds(
    createGroupPreview([first, second]),
    first.id,
    new Set([second.id]),
  );

  assert.equal(result.shouldClearActiveItem, true);
  assert.deepEqual(result.preview.items.map((item) => item.id), [second.id]);
});

test("deleting the final archive item closes the preview family", () => {
  const item = createItem("only", 11);
  const result = reconcilePreviewWithHistoryIds(
    createGroupPreview([item]),
    item.id,
    new Set(),
  );

  assert.equal(result.shouldClearActiveItem, true);
  assert.equal(result.preview, null);
});

test("deleting a main item detail closes that detail", () => {
  const item = createItem("main", 1);
  const result = reconcilePreviewWithHistoryIds(
    {
      appearanceTheme: "system",
      autoPaste: false,
      item,
      kind: "item",
      language: "system",
    },
    null,
    new Set(),
  );

  assert.equal(result.preview, null);
});
