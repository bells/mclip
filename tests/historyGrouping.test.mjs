import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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
    `mclip-${path.basename(sourcePath, ".ts")}-${Date.now()}.mjs`,
  );

  await writeFile(compiledPath, output.outputText, "utf8");

  return import(compiledPath);
}

const { getHistoryGroupItems, getHistoryGroups } = await importTypeScriptModule(
  "src/utils/history.ts",
);

function makeItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index + 1}`,
    position: index + 1,
  }));
}

test("history groups split main window count from archive group count", () => {
  assert.deepEqual(getHistoryGroups(32, 8, 12), [
    {
      endPosition: 8,
      index: 0,
      label: "1",
      startPosition: 1,
    },
    {
      endPosition: 20,
      index: 1,
      label: "2",
      startPosition: 9,
    },
    {
      endPosition: 32,
      index: 2,
      label: "3",
      startPosition: 21,
    },
  ]);
});

test("archive group items are sliced from absolute group positions", () => {
  const items = makeItems(32);
  const groups = getHistoryGroups(items.length, 8, 12);

  assert.deepEqual(
    getHistoryGroupItems(items, groups[1]).map((item) => item.id),
    [
      "item-9",
      "item-10",
      "item-11",
      "item-12",
      "item-13",
      "item-14",
      "item-15",
      "item-16",
      "item-17",
      "item-18",
      "item-19",
      "item-20",
    ],
  );
});
