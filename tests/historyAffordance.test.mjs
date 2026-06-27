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

const { getTextHistoryAffordance } = await importTypeScriptModule(
  "src/utils/historyAffordance.ts",
);

test("hex and rgb color text produce a color affordance", () => {
  assert.deepEqual(getTextHistoryAffordance("  #7cc7c1  "), {
    color: "#7cc7c1",
    kind: "color",
  });
  assert.deepEqual(getTextHistoryAffordance("rgba(124, 199, 193, 0.48)"), {
    color: "rgba(124, 199, 193, 0.48)",
    kind: "color",
  });
});

test("invalid color-like text is not treated as a swatch", () => {
  assert.equal(getTextHistoryAffordance("#12"), null);
  assert.equal(getTextHistoryAffordance("rgb(999, 0, 0)"), null);
  assert.equal(getTextHistoryAffordance("hello #7cc7c1"), null);
});

test("emoji-only short text produces an emoji affordance", () => {
  assert.deepEqual(getTextHistoryAffordance("🔥"), {
    emoji: "🔥",
    kind: "emoji",
  });
  assert.deepEqual(getTextHistoryAffordance("👍🏽"), {
    emoji: "👍🏽",
    kind: "emoji",
  });
});

test("mixed text with emoji keeps the normal text treatment", () => {
  assert.equal(getTextHistoryAffordance("done ✅"), null);
  assert.equal(getTextHistoryAffordance("mclip"), null);
});
