// 纯前端历史列表工具：负责搜索过滤、分组计算和分页取数。

import type { HistoryGroupInfo, HistoryListItem } from "../types";

export function filterHistoryItems(
  history: string[],
  searchQuery: string,
): HistoryListItem[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  // id 带上原始位置和文本，避免相同文本在渲染时出现不稳定 key。
  return history
    .map((text, index) => ({
      id: `${index}:${text}`,
      position: index + 1,
      text,
    }))
    .filter(
      (item) =>
        normalizedQuery === "" ||
        item.text.toLowerCase().includes(normalizedQuery),
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
