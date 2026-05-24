// 纯前端历史列表工具：负责搜索过滤、分组计算和分页取数。

import type { HistoryEntry, HistoryGroupInfo, HistoryListItem } from "../types";

export function getHistoryItemSearchText(item: HistoryEntry): string {
  const commonText = `${item.displayText} ${item.sourceApp ?? ""}`;

  switch (item.kind) {
    case "text":
      return `${commonText} ${item.text}`;
    case "files":
      return `${commonText} ${item.filePaths.join(" ")}`;
    case "image":
      return `${commonText} image ${item.width}x${item.height}`;
  }
}

export function filterHistoryItems(
  history: HistoryEntry[],
  searchQuery: string,
): HistoryListItem[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return history
    .map((entry, index) => ({
      ...entry,
      renderId: `${index}:${entry.id}:${entry.lastCopiedAt}`,
      position: index + 1,
    }))
    .filter(
      (item) =>
        normalizedQuery === "" ||
        getHistoryItemSearchText(item).toLowerCase().includes(normalizedQuery),
    );
}

export function getHistoryGroups(
  itemCount: number,
  groupSize: number,
): HistoryGroupInfo[] {
  const groupCount = Math.ceil(itemCount / groupSize);

  return Array.from({ length: groupCount }, (_, index) => {
    const startPosition = index * groupSize + 1;
    const endPosition = (index + 1) * groupSize;

    // 分组范围按完整组显示，例如实际只有第 11 条，也显示 11-20。
    return {
      endPosition,
      index,
      label: String(index + 1),
      startPosition,
    };
  });
}

export function getHistoryGroupItems(
  items: HistoryListItem[],
  groupIndex: number,
  groupSize: number,
): HistoryListItem[] {
  const startIndex = groupIndex * groupSize;
  return items.slice(startIndex, startIndex + groupSize);
}
