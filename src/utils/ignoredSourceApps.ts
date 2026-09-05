export function mergeIgnoredSourceAppIds(
  current: readonly string[],
  additions: readonly string[],
  limit: number,
): string[] | null {
  const merged = [...new Set([...current, ...additions])];
  return merged.length <= limit ? merged : null;
}
