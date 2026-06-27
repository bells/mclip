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

const { resolveAppTheme } = await importTypeScriptModule("src/utils/theme.ts");

test("explicit appearance themes resolve without system preference", () => {
  assert.equal(resolveAppTheme("light", true), "light");
  assert.equal(resolveAppTheme("light", false), "light");
  assert.equal(resolveAppTheme("dark", true), "dark");
  assert.equal(resolveAppTheme("dark", false), "dark");
});

test("system appearance theme follows dark preference", () => {
  assert.equal(resolveAppTheme("system", true), "dark");
  assert.equal(resolveAppTheme("system", false), "light");
});
