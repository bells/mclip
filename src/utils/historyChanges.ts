import type {
  HistoryChange,
  HistoryEntry,
  HistorySnapshot,
} from "../types";

export type HistoryChangeApplication =
  | {
      snapshot: HistorySnapshot;
      status: "applied" | "ignored";
    }
  | {
      snapshot: HistorySnapshot;
      status: "needsReplace";
    };

function withoutIds(entries: HistoryEntry[], removedIds: readonly string[]) {
  if (removedIds.length === 0) {
    return entries;
  }

  const removedIdSet = new Set(removedIds);
  return entries.filter((entry) => !removedIdSet.has(entry.id));
}

function canonicalHistoryOrder(entries: HistoryEntry[]) {
  return [...entries].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }
    if (left.isPinned && left.pinnedAt !== right.pinnedAt) {
      return (right.pinnedAt ?? 0) - (left.pinnedAt ?? 0);
    }
    return right.lastCopiedAt - left.lastCopiedAt || left.id.localeCompare(right.id);
  });
}

export function applyHistoryChange(
  snapshot: HistorySnapshot,
  change: HistoryChange,
): HistoryChangeApplication {
  if (change.revision <= snapshot.revision) {
    return { snapshot, status: "ignored" };
  }

  if (change.kind === "replace") {
    return {
      snapshot: { entries: change.entries, revision: change.revision },
      status: "applied",
    };
  }

  if (change.baseRevision !== snapshot.revision) {
    return { snapshot, status: "needsReplace" };
  }

  switch (change.kind) {
    case "upsert":
      return {
        snapshot: {
          entries: canonicalHistoryOrder([
            change.entry,
            ...withoutIds(snapshot.entries, [
              change.entry.id,
              ...change.removedIds,
            ]),
          ]),
          revision: change.revision,
        },
        status: "applied",
      };
    case "remove":
      return {
        snapshot: {
          entries: withoutIds(snapshot.entries, change.removedIds),
          revision: change.revision,
        },
        status: "applied",
      };
    case "clear":
      return {
        snapshot: { entries: [], revision: change.revision },
        status: "applied",
      };
  }
}
