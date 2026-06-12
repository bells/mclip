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
  isReleaseNewer,
  parseGitHubLatestReleaseResponse,
} = await importTypeScriptModule("src/utils/updateCheck.ts");

test("release comparison treats v-prefixed semantic versions as newer", () => {
  assert.equal(isReleaseNewer("v0.2.0", "0.1.9"), true);
  assert.equal(isReleaseNewer("0.1.0", "v0.1.0"), false);
  assert.equal(isReleaseNewer("v0.0.9", "0.1.0"), false);
});

test("release comparison handles multi-digit version parts numerically", () => {
  assert.equal(isReleaseNewer("v0.10.0", "0.9.9"), true);
  assert.equal(isReleaseNewer("v1.0.0", "0.12.0"), true);
});

test("release comparison rejects malformed semantic versions", () => {
  assert.equal(isReleaseNewer("v1..0", "0.1.0"), false);
  assert.equal(isReleaseNewer("v1.0", "0.1.0"), false);
});

test("GitHub latest release parser extracts version and release URL", () => {
  assert.deepEqual(
    parseGitHubLatestReleaseResponse({
      tag_name: "v0.2.0",
      html_url: "https://github.com/bells/mclip/releases/tag/v0.2.0",
    }),
    {
      releaseUrl: "https://github.com/bells/mclip/releases/tag/v0.2.0",
      version: "0.2.0",
    },
  );
});

test("GitHub latest release parser ignores malformed responses", () => {
  assert.equal(parseGitHubLatestReleaseResponse({ tag_name: "" }), null);
  assert.equal(parseGitHubLatestReleaseResponse(null), null);
});
