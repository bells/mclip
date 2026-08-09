import type {
  HistoryPreviewInvalidation,
  HistoryPreviewPayload,
} from "../types";

export type PreviewHistoryReconciliation = {
  preview: HistoryPreviewPayload | null;
  shouldClearActiveItem: boolean;
};

export function reconcilePreviewWithInvalidation(
  preview: HistoryPreviewPayload,
  activeItemId: string | null,
  invalidation: HistoryPreviewInvalidation,
): PreviewHistoryReconciliation {
  if (invalidation.revision <= preview.historyRevision) {
    return { preview, shouldClearActiveItem: false };
  }

  if (
    invalidation.closeCurrentPreview ||
    invalidation.baseRevision !== preview.historyRevision
  ) {
    return {
      preview: null,
      shouldClearActiveItem: activeItemId !== null,
    };
  }

  const removedIds = new Set(invalidation.removedIds);
  const shouldClearActiveItem =
    activeItemId !== null && removedIds.has(activeItemId);

  if (preview.kind === "item") {
    return {
      preview: removedIds.has(preview.item.id)
        ? null
        : { ...preview, historyRevision: invalidation.revision },
      shouldClearActiveItem,
    };
  }

  const nextItems = preview.items.filter((item) => !removedIds.has(item.id));

  return {
    preview:
      nextItems.length === 0
        ? null
        : {
            ...preview,
            historyRevision: invalidation.revision,
            items: nextItems,
          },
    shouldClearActiveItem,
  };
}
