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

const {
  getGroupPreviewEntryKey,
  getGroupPreviewReturnKey,
  getNextGroupPreviewItemIndex,
  getNextMainKeyboardNavigationTarget,
  shouldClearPreviewForMainKeyboardTarget,
  shouldActivateGroupPreviewPointerItem,
  serializeMainKeyboardNavigationTarget,
} = await importTypeScriptModule("src/utils/keyboardNavigation.ts");

test("arrow up from the first visible item moves back to the search input", () => {
  const currentTarget = serializeMainKeyboardNavigationTarget({
    index: 0,
    kind: "history-item",
  });

  assert.deepEqual(
    getNextMainKeyboardNavigationTarget(currentTarget, -1, {
      canClearHistory: true,
      historyGroupCount: 2,
      visibleHistoryCount: 10,
    }),
    {
      kind: "search",
    },
  );
});

test("focusing the search input clears any open preview", () => {
  const searchTarget = serializeMainKeyboardNavigationTarget({
    kind: "search",
  });
  const historyTarget = serializeMainKeyboardNavigationTarget({
    index: 0,
    kind: "history-item",
  });

  assert.equal(shouldClearPreviewForMainKeyboardTarget(searchTarget), true);
  assert.equal(shouldClearPreviewForMainKeyboardTarget(historyTarget), false);
});

test("arrow down after the tenth visible item moves into the first archive group", () => {
  const currentTarget = serializeMainKeyboardNavigationTarget({
    index: 9,
    kind: "history-item",
  });

  assert.deepEqual(
    getNextMainKeyboardNavigationTarget(currentTarget, 1, {
      canClearHistory: true,
      historyGroupCount: 2,
      visibleHistoryCount: 10,
    }),
    {
      groupIndex: 1,
      kind: "history-group",
    },
  );
});

test("arrow down after the last visible item moves to clear history when no archive group exists", () => {
  const currentTarget = serializeMainKeyboardNavigationTarget({
    index: 9,
    kind: "history-item",
  });

  assert.deepEqual(
    getNextMainKeyboardNavigationTarget(currentTarget, 1, {
      canClearHistory: true,
      historyGroupCount: 1,
      visibleHistoryCount: 10,
    }),
    {
      action: "clearHistory",
      kind: "footer-action",
    },
  );
});

test("footer navigation continues downward through the menu actions", () => {
  const currentTarget = serializeMainKeyboardNavigationTarget({
    action: "clearHistory",
    kind: "footer-action",
  });

  assert.deepEqual(
    getNextMainKeyboardNavigationTarget(currentTarget, 1, {
      canClearHistory: true,
      historyGroupCount: 1,
      visibleHistoryCount: 10,
    }),
    {
      action: "preferences",
      kind: "footer-action",
    },
  );
});

test("arrow down from the last archive group moves to clear history", () => {
  const currentTarget = serializeMainKeyboardNavigationTarget({
    groupIndex: 4,
    kind: "history-group",
  });

  assert.deepEqual(
    getNextMainKeyboardNavigationTarget(currentTarget, 1, {
      canClearHistory: true,
      historyGroupCount: 5,
      visibleHistoryCount: 10,
    }),
    {
      action: "clearHistory",
      kind: "footer-action",
    },
  );
});

test("keyboard navigation wraps from quit to the search input", () => {
  const currentTarget = serializeMainKeyboardNavigationTarget({
    action: "quit",
    kind: "footer-action",
  });

  assert.deepEqual(
    getNextMainKeyboardNavigationTarget(currentTarget, 1, {
      canClearHistory: true,
      historyGroupCount: 2,
      visibleHistoryCount: 10,
    }),
    {
      kind: "search",
    },
  );
});

test("keyboard navigation wraps from the search input to quit", () => {
  const currentTarget = serializeMainKeyboardNavigationTarget({
    kind: "search",
  });

  assert.deepEqual(
    getNextMainKeyboardNavigationTarget(currentTarget, -1, {
      canClearHistory: true,
      historyGroupCount: 2,
      visibleHistoryCount: 10,
    }),
    {
      action: "quit",
      kind: "footer-action",
    },
  );
});

test("group preview entry key points toward the preview window side", () => {
  assert.equal(getGroupPreviewEntryKey("right"), "ArrowRight");
  assert.equal(getGroupPreviewEntryKey("left"), "ArrowLeft");
});

test("group preview return key points back toward the main window", () => {
  assert.equal(getGroupPreviewReturnKey("right"), "ArrowLeft");
  assert.equal(getGroupPreviewReturnKey("left"), "ArrowRight");
});

test("group preview item navigation starts on the first item and clamps at the edges", () => {
  assert.equal(getNextGroupPreviewItemIndex(null, 1, 10), 0);
  assert.equal(getNextGroupPreviewItemIndex(0, 1, 10), 1);
  assert.equal(getNextGroupPreviewItemIndex(0, -1, 10), 0);
  assert.equal(getNextGroupPreviewItemIndex(9, 1, 10), 9);
});

test("group preview pointer polling resumes hover after keyboard navigation only after the pointer moves", () => {
  assert.equal(
    shouldActivateGroupPreviewPointerItem({
      hasPointerMoved: true,
      isKeyboardNavigating: true,
      itemId: "item-2",
    }),
    true,
  );
  assert.equal(
    shouldActivateGroupPreviewPointerItem({
      hasPointerMoved: false,
      isKeyboardNavigating: true,
      itemId: "item-2",
    }),
    false,
  );
  assert.equal(
    shouldActivateGroupPreviewPointerItem({
      hasPointerMoved: false,
      isKeyboardNavigating: false,
      itemId: "item-2",
    }),
    true,
  );
  assert.equal(
    shouldActivateGroupPreviewPointerItem({
      hasPointerMoved: true,
      isKeyboardNavigating: true,
      itemId: null,
    }),
    false,
  );
});
