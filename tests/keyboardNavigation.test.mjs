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
  getMainHistoryDeleteTargetId,
  getMainPointerActivatedTargetId,
  getNextGroupPreviewItemIndex,
  getNextMainKeyboardNavigationTarget,
  MAIN_SEARCH_TARGET_ID,
  reconcileMainKeyboardNavigationTargetId,
  shouldClearPreviewForMainKeyboardTarget,
  shouldActivateGroupPreviewPointerItem,
  serializeMainKeyboardNavigationTarget,
} = await importTypeScriptModule("src/utils/keyboardNavigation.ts");

function visibleHistoryItemIds(count = 10) {
  return Array.from({ length: count }, (_, index) => `item-${index}`);
}

test("arrow up from the first visible item moves back to the search input", () => {
  const currentTarget = serializeMainKeyboardNavigationTarget({
    itemId: "item-0",
    kind: "history-item",
  });

  assert.deepEqual(
    getNextMainKeyboardNavigationTarget(currentTarget, -1, {
      canClearHistory: true,
      historyGroupCount: 2,
      visibleHistoryItemIds: visibleHistoryItemIds(),
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
    itemId: "item-0",
    kind: "history-item",
  });

  assert.equal(shouldClearPreviewForMainKeyboardTarget(searchTarget), true);
  assert.equal(shouldClearPreviewForMainKeyboardTarget(historyTarget), false);
});

test("arrow down after the tenth visible item moves into the first archive group", () => {
  const currentTarget = serializeMainKeyboardNavigationTarget({
    itemId: "item-9",
    kind: "history-item",
  });

  assert.deepEqual(
    getNextMainKeyboardNavigationTarget(currentTarget, 1, {
      canClearHistory: true,
      historyGroupCount: 2,
      visibleHistoryItemIds: visibleHistoryItemIds(),
    }),
    {
      groupIndex: 1,
      kind: "history-group",
    },
  );
});

test("arrow down after the last visible item moves to clear history when no archive group exists", () => {
  const currentTarget = serializeMainKeyboardNavigationTarget({
    itemId: "item-9",
    kind: "history-item",
  });

  assert.deepEqual(
    getNextMainKeyboardNavigationTarget(currentTarget, 1, {
      canClearHistory: true,
      historyGroupCount: 1,
      visibleHistoryItemIds: visibleHistoryItemIds(),
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
      visibleHistoryItemIds: visibleHistoryItemIds(),
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
      visibleHistoryItemIds: visibleHistoryItemIds(),
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
      visibleHistoryItemIds: visibleHistoryItemIds(),
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
      visibleHistoryItemIds: visibleHistoryItemIds(),
    }),
    {
      action: "quit",
      kind: "footer-action",
    },
  );
});

test("search is the canonical default when the active target is missing", () => {
  assert.equal(
    reconcileMainKeyboardNavigationTargetId(null, {
      canClearHistory: true,
      historyGroupCount: 2,
      visibleHistoryItemIds: visibleHistoryItemIds(),
    }),
    MAIN_SEARCH_TARGET_ID,
  );
});

test("removed history targets reconcile to search without changing valid targets", () => {
  const validTarget = serializeMainKeyboardNavigationTarget({
    itemId: "item-2",
    kind: "history-item",
  });
  const removedTarget = serializeMainKeyboardNavigationTarget({
    itemId: "removed-item",
    kind: "history-item",
  });
  const context = {
    canClearHistory: true,
    historyGroupCount: 1,
    visibleHistoryItemIds: visibleHistoryItemIds(3),
  };

  assert.equal(reconcileMainKeyboardNavigationTargetId(validTarget, context), validTarget);
  assert.equal(
    reconcileMainKeyboardNavigationTargetId(removedTarget, context),
    MAIN_SEARCH_TARGET_ID,
  );
});

test("pointer movement takes over the active target but disabled targets do not", () => {
  const historyTarget = serializeMainKeyboardNavigationTarget({
    itemId: "item-2",
    kind: "history-item",
  });
  const preferencesTarget = serializeMainKeyboardNavigationTarget({
    action: "preferences",
    kind: "footer-action",
  });
  const context = {
    canClearHistory: true,
    historyGroupCount: 1,
    visibleHistoryItemIds: visibleHistoryItemIds(3),
  };

  assert.equal(
    getMainPointerActivatedTargetId({
      ...context,
      currentTargetId: MAIN_SEARCH_TARGET_ID,
      hasPointerMoved: true,
      isDisabled: false,
      pointerTargetId: historyTarget,
    }),
    historyTarget,
  );
  assert.equal(
    getMainPointerActivatedTargetId({
      ...context,
      currentTargetId: historyTarget,
      hasPointerMoved: true,
      isDisabled: true,
      pointerTargetId: preferencesTarget,
    }),
    historyTarget,
  );
});

test("arrow navigation continues from the latest pointer-activated target", () => {
  const pointerTarget = serializeMainKeyboardNavigationTarget({
    itemId: "item-1",
    kind: "history-item",
  });
  const context = {
    canClearHistory: true,
    historyGroupCount: 1,
    visibleHistoryItemIds: visibleHistoryItemIds(3),
  };
  const activeTargetId = getMainPointerActivatedTargetId({
    ...context,
    currentTargetId: MAIN_SEARCH_TARGET_ID,
    hasPointerMoved: true,
    isDisabled: false,
    pointerTargetId: pointerTarget,
  });

  assert.deepEqual(getNextMainKeyboardNavigationTarget(activeTargetId, 1, context), {
    itemId: "item-2",
    kind: "history-item",
  });
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

test("delete key targets only the active main history item", () => {
  assert.equal(
    getMainHistoryDeleteTargetId({
      activeTarget: {
        itemId: "item-2",
        kind: "history-item",
      },
      hasModifier: false,
      isClearConfirmOpen: false,
      isEditingText: false,
      isKeyboardPreviewGroupActive: false,
      key: "Delete",
    }),
    "item-2",
  );
  assert.equal(
    getMainHistoryDeleteTargetId({
      activeTarget: {
        itemId: "item-2",
        kind: "history-item",
      },
      hasModifier: false,
      isClearConfirmOpen: false,
      isEditingText: false,
      isKeyboardPreviewGroupActive: false,
      key: "Backspace",
    }),
    "item-2",
  );
  assert.equal(
    getMainHistoryDeleteTargetId({
      activeTarget: {
        kind: "search",
      },
      hasModifier: false,
      isClearConfirmOpen: false,
      isEditingText: true,
      isKeyboardPreviewGroupActive: false,
      key: "Backspace",
    }),
    null,
  );
  assert.equal(
    getMainHistoryDeleteTargetId({
      activeTarget: {
        itemId: "item-2",
        kind: "history-item",
      },
      hasModifier: true,
      isClearConfirmOpen: false,
      isEditingText: false,
      isKeyboardPreviewGroupActive: false,
      key: "Delete",
    }),
    null,
  );
  assert.equal(
    getMainHistoryDeleteTargetId({
      activeTarget: {
        itemId: "item-2",
        kind: "history-item",
      },
      hasModifier: false,
      isClearConfirmOpen: false,
      isEditingText: false,
      isKeyboardPreviewGroupActive: true,
      key: "Delete",
    }),
    null,
  );
});
