import type {
  HistoryPreviewInvalidation,
  HistoryPreviewPayload,
} from "../types";
import { maskSensitiveHistoryEntry } from "./sensitiveContent";

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
    const nextItem =
      invalidation.kind === "upsert" && invalidation.entry.id === preview.item.id
        ? maskSensitiveHistoryEntry(
            {
              ...invalidation.entry,
              renderId: preview.item.renderId,
              position: preview.item.position,
            },
            preview.maskSensitiveContent,
          )
        : preview.item;
    return {
      preview: removedIds.has(preview.item.id)
        ? null
        : { ...preview, historyRevision: invalidation.revision, item: nextItem },
      shouldClearActiveItem,
    };
  }

  const nextItems = preview.items
    .filter((item) => !removedIds.has(item.id))
    .flatMap((item) => {
      if (invalidation.kind !== "upsert" || invalidation.entry.id !== item.id) {
        return [item];
      }
      return invalidation.entry.isPinned
        ? []
        : [
            maskSensitiveHistoryEntry(
              {
                ...invalidation.entry,
                renderId: item.renderId,
                position: item.position,
              },
              preview.maskSensitiveContent,
            ),
          ];
    });

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
