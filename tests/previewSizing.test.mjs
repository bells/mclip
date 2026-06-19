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
  getGroupDetailPreviewOffset,
  getGroupPreviewHeight,
  getGroupPreviewHeightWithDetail,
  getItemPreviewAnchorTop,
  getItemPreviewHeight,
} = await importTypeScriptModule("src/utils/preview.ts");

test("history group preview uses compact row sizing", () => {
  assert.equal(getGroupPreviewHeight(10), 394);
  assert.equal(getGroupDetailPreviewOffset(3), 102);
});

test("history group preview height expands only when the detail needs it", () => {
  assert.equal(getGroupPreviewHeightWithDetail(10, 220, 2), 394);
  assert.equal(getGroupPreviewHeightWithDetail(10, 260, 8), 532);
});

test("item detail preview sizing follows the compact preview chrome", () => {
  assert.equal(
    getItemPreviewHeight({
      kind: "text",
      text: "short copied text",
    }),
    192,
  );
  assert.equal(getItemPreviewAnchorTop(100), 54);
});
