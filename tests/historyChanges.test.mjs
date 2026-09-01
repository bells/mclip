import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

async function importTypeScriptModule(sourcePath) {
  const absoluteSourcePath = path.resolve(sourcePath);
  const source = await readFile(absoluteSourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: absoluteSourcePath,
  });
  const compiledPath = path.join(
    tmpdir(),
    `mclip-history-changes-${Date.now()}-${Math.random()}.mjs`,
  );

  await writeFile(compiledPath, output.outputText, "utf8");
  return import(pathToFileURL(compiledPath).href);
}

const { applyHistoryChange } = await importTypeScriptModule(
  "src/utils/historyChanges.ts",
);

function textEntry(id, text = id, copyCount = 1, lastCopiedAt = 1) {
  return {
    copyCount,
    displayText: text,
    firstCopiedAt: 1,
    id,
    isPinned: false,
    kind: "text",
    lastCopiedAt,
    pinnedAt: null,
    sourceApp: null,
    text,
  };
}

function apply(snapshot, change) {
  const result = applyHistoryChange(snapshot, change);
  assert.notEqual(result.status, "needsReplace");
  return result.snapshot;
}

test("upsert inserts at the front and removes entries trimmed by Rust", () => {
  const first = textEntry("first");
  const second = textEntry("second");
  const inserted = textEntry("inserted", "new", 1, 3);

  const snapshot = apply(
    { entries: [first, second], revision: 4 },
    {
      baseRevision: 4,
      entry: inserted,
      kind: "upsert",
      removedIds: [second.id],
      revision: 5,
    },
  );

  assert.deepEqual(snapshot.entries.map((entry) => entry.id), ["inserted", "first"]);
});

test("dedupe upsert moves one entry and updates copy count and time", () => {
  const existing = textEntry("same", "same text");
  const updated = textEntry("same", "same text", 2, 20);
  const snapshot = apply(
    { entries: [textEntry("first"), existing], revision: 5 },
    {
      baseRevision: 5,
      entry: updated,
      kind: "upsert",
      removedIds: [],
      revision: 6,
    },
  );

  assert.deepEqual(snapshot.entries.map((entry) => entry.id), ["same", "first"]);
  assert.equal(snapshot.entries[0].copyCount, 2);
  assert.equal(snapshot.entries[0].lastCopiedAt, 20);
});

test("remove, clear, and replace recover the complete snapshot", () => {
  const initial = { entries: [textEntry("one"), textEntry("two")], revision: 8 };
  const removed = apply(initial, {
    baseRevision: 8,
    kind: "remove",
    removedIds: ["one"],
    revision: 9,
  });
  const cleared = apply(removed, {
    baseRevision: 9,
    kind: "clear",
    revision: 10,
  });
  const replaced = apply(cleared, {
    baseRevision: 3,
    entries: [textEntry("external")],
    kind: "replace",
    revision: 12,
  });

  assert.deepEqual(removed.entries.map((entry) => entry.id), ["two"]);
  assert.deepEqual(cleared.entries, []);
  assert.deepEqual(replaced.entries.map((entry) => entry.id), ["external"]);
});

test("duplicate and older deliveries cannot duplicate or revert history", () => {
  const change = {
    baseRevision: 11,
    entry: textEntry("new"),
    kind: "upsert",
    removedIds: [],
    revision: 12,
  };
  const applied = apply({ entries: [textEntry("old")], revision: 11 }, change);
  const duplicate = applyHistoryChange(applied, change);
  const older = applyHistoryChange(applied, {
    baseRevision: 9,
    kind: "remove",
    removedIds: ["new"],
    revision: 10,
  });

  assert.equal(duplicate.status, "ignored");
  assert.equal(older.status, "ignored");
  assert.strictEqual(duplicate.snapshot, applied);
  assert.strictEqual(older.snapshot, applied);
});

test("a missing intermediate delta requests full replace recovery", () => {
  const snapshot = { entries: [textEntry("old")], revision: 4 };
  const result = applyHistoryChange(snapshot, {
    baseRevision: 5,
    kind: "remove",
    removedIds: ["old"],
    revision: 6,
  });

  assert.equal(result.status, "needsReplace");
  assert.strictEqual(result.snapshot, snapshot);
});

test("pin upserts preserve canonical visible order without a full replace", () => {
  const pinned = {
    ...textEntry("older", "older", 1, 1),
    isPinned: true,
    pinnedAt: 20,
  };
  const snapshot = apply(
    { entries: [textEntry("newer", "newer", 1, 10), textEntry("older", "older", 1, 1)], revision: 1 },
    {
      baseRevision: 1,
      entry: pinned,
      kind: "upsert",
      removedIds: [],
      revision: 2,
    },
  );
  assert.deepEqual(snapshot.entries.map((entry) => entry.id), ["older", "newer"]);
});

test("accepted deltas remain correct under active search and grouping", async () => {
  const { filterHistoryItems, getHistoryGroupItems, getHistoryGroups } =
    await importTypeScriptModule("src/utils/history.ts");
  const initialEntries = [
    textEntry("alpha-1", "alpha first"),
    textEntry("beta", "beta"),
    textEntry("alpha-2", "alpha second"),
  ];
  const snapshot = apply(
    { entries: initialEntries, revision: 20 },
    {
      baseRevision: 20,
      entry: textEntry("alpha-3", "alpha newest", 1, 30),
      kind: "upsert",
      removedIds: [],
      revision: 21,
    },
  );
  const filtered = filterHistoryItems(snapshot.entries, "alpha");
  const groups = getHistoryGroups(filtered.length, 2, 2);

  assert.deepEqual(filtered.map((entry) => entry.id), [
    "alpha-3",
    "alpha-1",
    "alpha-2",
  ]);
  assert.deepEqual(
    getHistoryGroupItems(filtered, groups[1]).map((entry) => entry.id),
    ["alpha-2"],
  );
});
