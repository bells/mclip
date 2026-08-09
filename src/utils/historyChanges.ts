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
          entries: [
            change.entry,
            ...withoutIds(snapshot.entries, [
              change.entry.id,
              ...change.removedIds,
            ]),
          ],
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
