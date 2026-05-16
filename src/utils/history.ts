import type { HistoryGroupInfo, HistoryListItem } from "../types";

export function filterHistoryItems(
  history: string[],
  searchQuery: string,
): HistoryListItem[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

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
    const endPosition = Math.min((index + 1) * groupSize, itemCount);

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
