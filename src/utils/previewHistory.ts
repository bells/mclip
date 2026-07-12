import type { HistoryPreviewPayload } from "../types";

export type PreviewHistoryReconciliation = {
  preview: HistoryPreviewPayload | null;
  shouldClearActiveItem: boolean;
};

export function reconcilePreviewWithHistoryIds(
  preview: HistoryPreviewPayload,
  activeItemId: string | null,
  existingIds: ReadonlySet<string>,
): PreviewHistoryReconciliation {
  const shouldClearActiveItem =
    activeItemId !== null && !existingIds.has(activeItemId);

  if (preview.kind === "item") {
    return {
      preview: existingIds.has(preview.item.id) ? preview : null,
      shouldClearActiveItem,
    };
  }

  const nextItems = preview.items.filter((item) => existingIds.has(item.id));

  return {
    preview:
      nextItems.length === 0
        ? null
        : {
            ...preview,
            items: nextItems,
          },
    shouldClearActiveItem,
  };
}
