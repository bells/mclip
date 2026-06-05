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

const { getSearchQueryAfterHistorySelection } = await importTypeScriptModule(
  "src/utils/searchInteraction.ts",
);

test("selecting a history item clears an active search query", () => {
  assert.equal(getSearchQueryAfterHistorySelection("invoice"), "");
});

test("selecting a history item keeps an empty search query empty", () => {
  assert.equal(getSearchQueryAfterHistorySelection(""), "");
});
