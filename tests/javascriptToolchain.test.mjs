import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("Node 24 and pnpm 10.33.0 are explicit for both workspace packages", async () => {
  const [rootPackageSource, sitePackageSource, nodeVersion] = await Promise.all([
    readSource("package.json"),
    readSource("site/package.json"),
    readSource(".node-version"),
  ]);
  const rootPackage = JSON.parse(rootPackageSource);
  const sitePackage = JSON.parse(sitePackageSource);

  for (const manifest of [rootPackage, sitePackage]) {
    assert.equal(manifest.engines?.node, ">=24 <25");
    assert.equal(manifest.packageManager, "pnpm@10.33.0");
  }
  assert.equal(nodeVersion.trim(), "24");
});

test("one pnpm workspace lock governs the application and website", async () => {
  const [workspace, lockfile] = await Promise.all([
    readSource("pnpm-workspace.yaml"),
    readSource("pnpm-lock.yaml"),
  ]);

  assert.match(workspace, /packages:\s*\n\s+- site/);
  assert.match(workspace, /onlyBuiltDependencies:[\s\S]*\n\s+- esbuild[\s\S]*\n\s+- sharp/);
  assert.match(lockfile, /importers:\s*\n\s*\n\s+\.:/);
  assert.match(lockfile, /\n\s{2}site:\s*\n/);
  assert.match(lockfile, /specifier: \^6\.4\.4\s*\n\s+version: 6\.4\.4/);
  assert.equal(existsSync("package-lock.json"), false);
  assert.equal(existsSync("site/package-lock.json"), false);
  assert.equal(existsSync("site/pnpm-lock.yaml"), false);
});

test("package scripts and Tauri lifecycle hooks are pnpm-native", async () => {
  const [rootPackageSource, tauriSource] = await Promise.all([
    readSource("package.json"),
    readSource("src-tauri/tauri.conf.json"),
  ]);
  const rootPackage = JSON.parse(rootPackageSource);
  const tauri = JSON.parse(tauriSource);
  const scripts = JSON.stringify(rootPackage.scripts);

  assert.doesNotMatch(scripts, /(^|[^p])npm (?:ci|run|--prefix)/);
  assert.match(rootPackage.scripts.check, /^pnpm run build && pnpm run check:rust$/);
  assert.match(rootPackage.scripts["site:build"], /^pnpm --dir site run build$/);
  assert.equal(tauri.build.beforeDevCommand, "pnpm run dev");
  assert.equal(tauri.build.beforeBuildCommand, "pnpm run build");
});

test("CI and release use Node 24 with frozen pnpm installs", async () => {
  const [ci, release] = await Promise.all([
    readSource(".github/workflows/ci.yml"),
    readSource(".github/workflows/release.yml"),
  ]);

  for (const workflow of [ci, release]) {
    assert.match(workflow, /uses: pnpm\/action-setup@v4/);
    assert.match(workflow, /uses: actions\/setup-node@v6[\s\S]*node-version: "24"/);
    assert.match(workflow, /cache: pnpm/);
    assert.match(workflow, /cache-dependency-path: pnpm-lock\.yaml/);
    assert.match(workflow, /pnpm install --frozen-lockfile/);
    assert.ok(
      workflow.indexOf("uses: pnpm/action-setup@v4") <
        workflow.indexOf("uses: actions/setup-node@v6"),
    );
    assert.doesNotMatch(workflow, /(^|[^p])npm (?:ci|run|--prefix)/m);
  }

  assert.match(ci, /pnpm run check/);
  assert.match(ci, /pnpm run tauri:build --bundles deb,appimage/);
  assert.doesNotMatch(ci, /pnpm run tauri:build -- --bundles/);
  assert.match(release, /ROOT_PACKAGE_VERSION/);
  assert.match(release, /SITE_PACKAGE_VERSION/);
  assert.match(release, /CARGO_PACKAGE_VERSION/);
  assert.match(release, /CARGO_LOCK_VERSION/);
  assert.doesNotMatch(release, /package-lock\.json|ROOT_LOCK_VERSION|SITE_LOCK_VERSION/);
  assert.ok(
    release.indexOf("pnpm install --frozen-lockfile") <
      release.indexOf("name: Verify release tag version"),
  );
});

test("Vercel builds the website with the workspace pnpm contract", async () => {
  const vercel = JSON.parse(await readSource("site/vercel.json"));

  assert.equal(vercel.installCommand, "pnpm install --frozen-lockfile");
  assert.equal(vercel.buildCommand, "pnpm run build");
  assert.equal(vercel.outputDirectory, "dist");
});

test("canonical guidance and localized product copy no longer teach npm", async () => {
  const canonicalPaths = [
    "README.md",
    "AGENTS.md",
    "openspec/project.md",
    "memory.md",
    "docs/linux-support.md",
    "src/i18n/en.ts",
    "src/i18n/zhCn.ts",
    "src/i18n/ja.ts",
    "site/src/pages/en/index.astro",
    "site/src/pages/zh/index.astro",
    "site/src/pages/ja/index.astro",
  ];
  const sources = await Promise.all(canonicalPaths.map(readSource));

  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(
      source,
      /(^|[^p])npm (?:ci|run|--prefix)/m,
      canonicalPaths[index],
    );
  }
  assert.match(sources[0], /corepack enable/);
  assert.match(sources[1], /corepack enable/);
  assert.match(sources[2], /corepack enable/);
  for (const source of sources.slice(5)) {
    assert.match(source, /pnpm run tauri:dev/);
  }
});
