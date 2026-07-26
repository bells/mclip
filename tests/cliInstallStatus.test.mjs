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
  getCliInstallErrorCode,
  getCliPrimaryAction,
} = await importTypeScriptModule("src/utils/cliInstall.ts");

test("CLI status maps to install, upgrade, reinstall, or no downgrade", () => {
  assert.equal(getCliPrimaryAction("notInstalled", true), "install");
  assert.equal(getCliPrimaryAction("outdated", true), "upgrade");
  assert.equal(getCliPrimaryAction("unknown", true), "upgrade");
  assert.equal(getCliPrimaryAction("current", true), "reinstall");
  assert.equal(getCliPrimaryAction("newer", true), "none");
  assert.equal(getCliPrimaryAction("outdated", false), "none");
});

test("CLI install errors retain stable backend error categories", () => {
  assert.equal(
    getCliInstallErrorCode(
      "CLI_RELEASE_UNAVAILABLE: HTTP 404 for a draft release",
    ),
    "CLI_RELEASE_UNAVAILABLE",
  );
  assert.equal(
    getCliInstallErrorCode(new Error("CLI_CHECKSUM_MISMATCH: bad digest")),
    "CLI_CHECKSUM_MISMATCH",
  );
  assert.equal(getCliInstallErrorCode("plain failure"), "UNKNOWN");
});

test("Preferences renders every version state and preserves status on failure", async () => {
  const source = await readFile("src/components/PreferencesWindow.tsx", "utf8");

  for (const state of [
    "notInstalled",
    "outdated",
    "unknown",
    "current",
    "newer",
  ]) {
    assert.match(source, new RegExp(`"${state}"`));
  }

  assert.match(source, /getCliPrimaryAction\(cliStatus\.state/);
  assert.match(source, /cliStatus\.installedVersion \?\? t\.cliUnknownVersion/);
  assert.match(source, /t\.cliVersionSummary/);
  assert.match(source, /case "CLI_CHECKSUM_MISMATCH":/);

  const catchBlock = source.slice(
    source.indexOf('console.error("安装 mclip-cli 失败:"'),
    source.indexOf("const copyCliInstallCommand"),
  );
  assert.doesNotMatch(
    catchBlock,
    /setCliStatus\(/,
    "failed installs should retain the last known installed status",
  );
});
