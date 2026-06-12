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

const {
  shouldAutoPasteAfterHistoryPreviewSelection,
  shouldAutoPasteAfterHistorySelection,
} = await importTypeScriptModule("src/utils/selectionBehavior.ts");

test("history selection auto-pastes only when the behavior is enabled", () => {
  assert.equal(shouldAutoPasteAfterHistorySelection({ autoPaste: true }), true);
  assert.equal(shouldAutoPasteAfterHistorySelection({ autoPaste: false }), false);
});

test("history preview selection auto-pastes only when the preview payload enables it", () => {
  assert.equal(
    shouldAutoPasteAfterHistoryPreviewSelection({ autoPaste: true }),
    true,
  );
  assert.equal(
    shouldAutoPasteAfterHistoryPreviewSelection({ autoPaste: false }),
    false,
  );
  assert.equal(shouldAutoPasteAfterHistoryPreviewSelection(null), false);
});
