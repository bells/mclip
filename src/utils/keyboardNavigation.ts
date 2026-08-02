export type FooterKeyboardAction =
  | "clearHistory"
  | "preferences"
  | "about"
  | "quit";

export type MainKeyboardNavigationTarget =
  | {
      kind: "search";
    }
  | {
      itemId: string;
      kind: "history-item";
    }
  | {
      groupIndex: number;
      kind: "history-group";
    }
  | {
      action: FooterKeyboardAction;
      kind: "footer-action";
    };

type MainKeyboardNavigationContext = {
  canClearHistory: boolean;
  historyGroupCount: number;
  visibleHistoryItemIds: string[];
};

type MainPointerActivationContext = MainKeyboardNavigationContext & {
  currentTargetId: string | null;
  hasPointerMoved: boolean;
  isDisabled: boolean;
  pointerTargetId: string | null;
};

type MainHistoryDeleteKeyContext = {
  activeTarget: MainKeyboardNavigationTarget | null;
  hasModifier: boolean;
  isClearConfirmOpen: boolean;
  isEditingText: boolean;
  isKeyboardPreviewGroupActive: boolean;
  key: string;
};

const FOOTER_ACTIONS: FooterKeyboardAction[] = [
  "clearHistory",
  "preferences",
  "about",
  "quit",
];

export const MAIN_SEARCH_TARGET_ID = "search";

export function serializeMainKeyboardNavigationTarget(
  target: MainKeyboardNavigationTarget,
): string {
  switch (target.kind) {
    case "search":
      return MAIN_SEARCH_TARGET_ID;
    case "history-item":
      return `history-item:${encodeURIComponent(target.itemId)}`;
    case "history-group":
      return `history-group:${target.groupIndex}`;
    case "footer-action":
      return `footer-action:${target.action}`;
  }
}

export function parseMainKeyboardNavigationTarget(
  targetId: string | null | undefined,
): MainKeyboardNavigationTarget | null {
  if (!targetId) {
    return null;
  }

  if (targetId === MAIN_SEARCH_TARGET_ID) {
    return { kind: "search" };
  }

  const [kind, rawValue] = targetId.split(":");

  if (kind === "history-item") {
    if (!rawValue) {
      return null;
    }

    try {
      return {
        itemId: decodeURIComponent(rawValue),
        kind: "history-item",
      };
    } catch {
      return null;
    }
  }

  if (kind === "history-group") {
    const groupIndex = Number(rawValue);
    return Number.isInteger(groupIndex) && groupIndex >= 1
      ? {
          groupIndex,
          kind: "history-group",
        }
      : null;
  }

  if (kind === "footer-action" && isFooterKeyboardAction(rawValue)) {
    return {
      action: rawValue,
      kind: "footer-action",
    };
  }

  return null;
}

export function getMainKeyboardNavigationTargets({
  canClearHistory,
  historyGroupCount,
  visibleHistoryItemIds,
}: MainKeyboardNavigationContext): MainKeyboardNavigationTarget[] {
  const searchTarget: MainKeyboardNavigationTarget = {
    kind: "search",
  };
  const historyTargets = visibleHistoryItemIds.map(
    (itemId): MainKeyboardNavigationTarget => ({
      itemId,
      kind: "history-item",
    }),
  );

  const archiveGroupTargets = Array.from(
    { length: Math.max(0, historyGroupCount - 1) },
    (_, index): MainKeyboardNavigationTarget => ({
      groupIndex: index + 1,
      kind: "history-group",
    }),
  );

  const footerTargets = FOOTER_ACTIONS.filter(
    (action) => canClearHistory || action !== "clearHistory",
  ).map(
    (action): MainKeyboardNavigationTarget => ({
      action,
      kind: "footer-action",
    }),
  );

  return [searchTarget, ...historyTargets, ...archiveGroupTargets, ...footerTargets];
}

export function reconcileMainKeyboardNavigationTargetId(
  currentTargetId: string | null,
  context: MainKeyboardNavigationContext,
): string {
  const targetIds = getMainKeyboardNavigationTargets(context).map(
    serializeMainKeyboardNavigationTarget,
  );

  return currentTargetId !== null && targetIds.includes(currentTargetId)
    ? currentTargetId
    : MAIN_SEARCH_TARGET_ID;
}

export function getMainPointerActivatedTargetId({
  currentTargetId,
  hasPointerMoved,
  isDisabled,
  pointerTargetId,
  ...context
}: MainPointerActivationContext): string {
  const reconciledCurrentTargetId = reconcileMainKeyboardNavigationTargetId(
    currentTargetId,
    context,
  );

  if (!hasPointerMoved || isDisabled || pointerTargetId === null) {
    return reconciledCurrentTargetId;
  }

  return reconcileMainKeyboardNavigationTargetId(pointerTargetId, context) ===
    pointerTargetId
    ? pointerTargetId
    : reconciledCurrentTargetId;
}

export function getNextMainKeyboardNavigationTarget(
  currentTargetId: string | null,
  direction: -1 | 1,
  context: MainKeyboardNavigationContext,
): MainKeyboardNavigationTarget | null {
  const targets = getMainKeyboardNavigationTargets(context);

  if (targets.length === 0) {
    return null;
  }

  const reconciledCurrentTargetId = reconcileMainKeyboardNavigationTargetId(
    currentTargetId,
    context,
  );

  const currentIndex = targets.findIndex(
    (target) =>
      serializeMainKeyboardNavigationTarget(target) === reconciledCurrentTargetId,
  );

  const nextIndex = (currentIndex + direction + targets.length) % targets.length;

  return targets[nextIndex];
}

export function shouldClearPreviewForMainKeyboardTarget(
  targetId: string | null | undefined,
): boolean {
  return parseMainKeyboardNavigationTarget(targetId)?.kind === "search";
}

export function getGroupPreviewEntryKey(side: "left" | "right"): "ArrowLeft" | "ArrowRight" {
  return side === "left" ? "ArrowLeft" : "ArrowRight";
}

export function getGroupPreviewReturnKey(side: "left" | "right"): "ArrowLeft" | "ArrowRight" {
  return side === "left" ? "ArrowRight" : "ArrowLeft";
}

export function getNextGroupPreviewItemIndex(
  currentIndex: number | null,
  direction: -1 | 1,
  itemCount: number,
): number | null {
  if (itemCount <= 0) {
    return null;
  }

  if (currentIndex === null || currentIndex < 0 || currentIndex >= itemCount) {
    return 0;
  }

  return Math.max(0, Math.min(itemCount - 1, currentIndex + direction));
}

export function getMainHistoryDeleteTargetId({
  activeTarget,
  hasModifier,
  isClearConfirmOpen,
  isEditingText,
  isKeyboardPreviewGroupActive,
  key,
}: MainHistoryDeleteKeyContext): string | null {
  if (key !== "Delete" && key !== "Backspace") {
    return null;
  }

  if (
    hasModifier ||
    isClearConfirmOpen ||
    isEditingText ||
    isKeyboardPreviewGroupActive ||
    activeTarget?.kind !== "history-item"
  ) {
    return null;
  }

  return activeTarget.itemId;
}

type GroupPreviewPointerActivationContext = {
  hasPointerMoved: boolean;
  isKeyboardNavigating: boolean;
  itemId: string | null;
};

export function shouldActivateGroupPreviewPointerItem({
  hasPointerMoved,
  isKeyboardNavigating,
  itemId,
}: GroupPreviewPointerActivationContext): boolean {
  if (!itemId) {
    return false;
  }

  return !isKeyboardNavigating || hasPointerMoved;
}

function isFooterKeyboardAction(value: string | undefined): value is FooterKeyboardAction {
  return FOOTER_ACTIONS.includes(value as FooterKeyboardAction);
}
