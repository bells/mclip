import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

async function importTypeScriptModule(sourcePath) {
  const absoluteSourcePath = path.resolve(sourcePath);
  const source = await readFile(absoluteSourcePath, "utf8");
  const sensitiveSource = await readFile(
    path.resolve("src/utils/sensitiveContent.ts"),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: absoluteSourcePath,
  });
  const compilationId = `mclip-${path.basename(sourcePath, ".ts")}-${Date.now()}`;
  const compiledPath = path.join(tmpdir(), `${compilationId}.mjs`);
  const sensitivePath = path.join(
    tmpdir(),
    `${compilationId}-sensitiveContent.mjs`,
  );
  const sensitiveOutput = ts.transpileModule(sensitiveSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: path.resolve("src/utils/sensitiveContent.ts"),
  });
  const compiledSource = output.outputText.replace(
    '"./sensitiveContent"',
    `"./${path.basename(sensitivePath)}"`,
  );

  await Promise.all([
    writeFile(compiledPath, compiledSource, "utf8"),
    writeFile(sensitivePath, sensitiveOutput.outputText, "utf8"),
  ]);
  return import(compiledPath);
}

const { reconcilePreviewWithInvalidation } = await importTypeScriptModule(
  "src/utils/previewHistory.ts",
);

function createItem(id, position) {
  return {
    copyCount: 1,
    displayText: id,
    firstCopiedAt: 1,
    id,
    isPinned: false,
    kind: "text",
    lastCopiedAt: 1,
    pinnedAt: null,
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
    historyRevision: 4,
    items,
    kind: "group",
    language: "system",
    maskSensitiveContent: true,
    showHistoryItemNumbers: true,
  };
}

function removeInvalidation(...removedIds) {
  return {
    baseRevision: 4,
    closeCurrentPreview: false,
    kind: "remove",
    removedIds,
    revision: 5,
  };
}

test("deleting an active archive item refreshes the remaining group", () => {
  const first = createItem("first", 11);
  const second = createItem("second", 12);
  const result = reconcilePreviewWithInvalidation(
    createGroupPreview([first, second]),
    first.id,
    removeInvalidation(first.id),
  );

  assert.equal(result.shouldClearActiveItem, true);
  assert.deepEqual(result.preview.items.map((item) => item.id), [second.id]);
});

test("deleting the final archive item closes the preview family", () => {
  const item = createItem("only", 11);
  const result = reconcilePreviewWithInvalidation(
    createGroupPreview([item]),
    item.id,
    removeInvalidation(item.id),
  );

  assert.equal(result.shouldClearActiveItem, true);
  assert.equal(result.preview, null);
});

test("deleting a main item detail closes that detail", () => {
  const item = createItem("main", 1);
  const result = reconcilePreviewWithInvalidation(
    {
      appearanceTheme: "system",
      autoPaste: false,
      historyRevision: 4,
      item,
      kind: "item",
      language: "system",
    },
    null,
    removeInvalidation(item.id),
  );

  assert.equal(result.preview, null);
});

test("clipboard upsert closes an old preview without a history array", () => {
  const item = createItem("current", 1);
  const result = reconcilePreviewWithInvalidation(
    {
      appearanceTheme: "system",
      autoPaste: false,
      historyRevision: 4,
      item,
      kind: "item",
      language: "system",
    },
    null,
    {
      baseRevision: 4,
      closeCurrentPreview: true,
      entry: createItem("replacement", 1),
      kind: "upsert",
      removedIds: [],
      revision: 5,
    },
  );

  assert.equal(result.preview, null);
});

test("pin upsert refreshes item detail but removes the item from an archive preview", () => {
  const item = createItem("pin-me", 11);
  const pinned = { ...item, isPinned: true, pinnedAt: 99 };
  const invalidation = {
    baseRevision: 4,
    closeCurrentPreview: false,
    entry: pinned,
    kind: "upsert",
    removedIds: [],
    revision: 5,
  };
  const detail = reconcilePreviewWithInvalidation(
    {
      appearanceTheme: "system",
      autoPaste: false,
      historyRevision: 4,
      item,
      kind: "item",
      language: "system",
    },
    null,
    invalidation,
  );
  const group = reconcilePreviewWithInvalidation(
    createGroupPreview([item, createItem("other", 12)]),
    item.id,
    invalidation,
  );

  assert.equal(detail.preview.item.isPinned, true);
  assert.deepEqual(group.preview.items.map((entry) => entry.id), ["other"]);
});

test("duplicate invalidation cannot close a newer preview payload", () => {
  const preview = { ...createGroupPreview([createItem("current", 1)]), historyRevision: 6 };
  const result = reconcilePreviewWithInvalidation(preview, null, {
    baseRevision: 4,
    closeCurrentPreview: true,
    kind: "clear",
    revision: 5,
  });

  assert.strictEqual(result.preview, preview);
});

test("a missing preview revision closes conservatively", () => {
  const result = reconcilePreviewWithInvalidation(
    createGroupPreview([createItem("current", 1)]),
    "current",
    {
      baseRevision: 5,
      closeCurrentPreview: false,
      kind: "remove",
      removedIds: ["other"],
      revision: 6,
    },
  );

  assert.equal(result.preview, null);
  assert.equal(result.shouldClearActiveItem, true);
});
