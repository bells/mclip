import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";

const MANIFEST_PATH = "dist/.vite/manifest.json";
const MAIN_ROUTE_SOURCE = "src/App.tsx";
const FORBIDDEN_MAIN_ROUTE_SOURCES = [
  "src/components/AboutWindow.tsx",
  "src/components/FullscreenImageViewer.tsx",
  "src/components/HistoryPreviewDetailWindow.tsx",
  "src/components/HistoryPreviewWindow.tsx",
  "src/components/PreferencesWindow.tsx",
];
const MAIN_INITIAL_JAVASCRIPT_GZIP_BUDGET = 75 * 1024;

async function readManifest() {
  return JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
}

function findManifestEntry(manifest, source) {
  const entry = Object.values(manifest).find((candidate) => candidate.src === source);
  assert.ok(entry, `Vite manifest is missing ${source}`);
  return entry;
}

function findBootstrapEntry(manifest) {
  const entry = Object.values(manifest).find((candidate) => candidate.isEntry);
  assert.ok(entry, "Vite manifest is missing its HTML bootstrap entry");
  return entry;
}

function collectStaticJavaScript(manifest, entry, collected = new Set()) {
  if (!entry.file.endsWith(".js") || collected.has(entry.file)) {
    return collected;
  }

  collected.add(entry.file);
  for (const importedKey of entry.imports ?? []) {
    const importedEntry = manifest[importedKey];
    assert.ok(importedEntry, `Vite manifest is missing static import ${importedKey}`);
    collectStaticJavaScript(manifest, importedEntry, collected);
  }
  return collected;
}

test("main window initial JavaScript stays within 75 KiB gzip", async () => {
  const manifest = await readManifest();
  const bootstrapEntry = findBootstrapEntry(manifest);
  const initialFiles = collectStaticJavaScript(manifest, bootstrapEntry);
  const gzipBytes = (await Promise.all(
    [...initialFiles].map(async (file) => gzipSync(
      await readFile(path.join("dist", file)),
    ).byteLength),
  )).reduce((total, size) => total + size, 0);

  assert.ok(
    gzipBytes <= MAIN_INITIAL_JAVASCRIPT_GZIP_BUDGET,
    `main initial JavaScript is ${gzipBytes} gzip bytes; budget is ${MAIN_INITIAL_JAVASCRIPT_GZIP_BUDGET}`,
  );
});

test("main window static graph excludes auxiliary route modules", async () => {
  const manifest = await readManifest();
  const mainRouteEntry = findManifestEntry(manifest, MAIN_ROUTE_SOURCE);
  const mainStaticFiles = collectStaticJavaScript(manifest, mainRouteEntry);
  const mainStaticSources = new Set(
    Object.values(manifest)
      .filter((entry) => mainStaticFiles.has(entry.file))
      .map((entry) => entry.src)
      .filter(Boolean),
  );

  for (const forbiddenSource of FORBIDDEN_MAIN_ROUTE_SOURCES) {
    assert.equal(
      mainStaticSources.has(forbiddenSource),
      false,
      `main route statically reaches ${forbiddenSource}`,
    );
  }
});

test("auxiliary routes keep shared foundations without main orchestration", async () => {
  const [manifest, bootstrapSource] = await Promise.all([
    readManifest(),
    readFile("src/main.tsx", "utf8"),
  ]);

  assert.match(bootstrapSource, /import "\.\/styles\.css"/);
  assert.match(bootstrapSource, /installClientErrorLogging\(\)/);
  assert.match(bootstrapSource, /<ErrorBoundary>/);
  assert.match(bootstrapSource, /recordFrontendPerformanceAfterPaint\("routeReady"/);

  for (const auxiliarySource of FORBIDDEN_MAIN_ROUTE_SOURCES) {
    const auxiliaryEntry = findManifestEntry(manifest, auxiliarySource);
    const auxiliaryStaticFiles = collectStaticJavaScript(manifest, auxiliaryEntry);
    const reachesMainRoute = Object.values(manifest).some(
      (entry) => entry.src === MAIN_ROUTE_SOURCE && auxiliaryStaticFiles.has(entry.file),
    );

    assert.equal(
      reachesMainRoute,
      false,
      `${auxiliarySource} statically reaches useClipboardApp through ${MAIN_ROUTE_SOURCE}`,
    );
  }
});
