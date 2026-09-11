import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

const ROUTE_SOURCES = {
  about: "src/components/AboutWindow.tsx",
  "image-viewer": "src/components/FullscreenImageViewer.tsx",
  main: "src/App.tsx",
  preferences: "src/components/PreferencesWindow.tsx",
  preview: "src/components/HistoryPreviewWindow.tsx",
  "preview-detail": "src/components/HistoryPreviewDetailWindow.tsx",
  "quick-action": "src/components/QuickActionWindow.tsx",
};

function parseArguments(argv) {
  const options = { distDir: "dist" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--dist-dir") {
      options.distDir = argv[index + 1];
      index += 1;
    }
  }
  return options;
}

function findEntryKey(manifest, predicate, description) {
  const match = Object.entries(manifest).find(([, entry]) => predicate(entry));
  if (!match) {
    throw new Error(`Vite manifest is missing ${description}`);
  }
  return match[0];
}

function collectStaticKeys(manifest, entryKey, collected = new Set()) {
  if (collected.has(entryKey)) {
    return collected;
  }
  const entry = manifest[entryKey];
  if (!entry) {
    throw new Error(`Vite manifest is missing static import ${entryKey}`);
  }

  collected.add(entryKey);
  for (const importedKey of entry.imports ?? []) {
    collectStaticKeys(manifest, importedKey, collected);
  }
  return collected;
}

async function inventory(distDir, relative = "") {
  const entries = await readdir(path.join(distDir, relative), { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const file = path.join(relative, entry.name);
    if (entry.isDirectory()) return inventory(distDir, file);
    if (!entry.isFile()) return [];
    const bytes = await readFile(path.join(distDir, file));
    return [{ file, rawBytes: bytes.byteLength, gzipBytes: gzipSync(bytes).byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex") }];
  }));
  return nested.flat().sort((left, right) => left.file.localeCompare(right.file));
}

function summarizeRequestSet(filesByName, manifest, entryKeys) {
  const staticKeys = new Set();
  entryKeys.forEach((entryKey) => collectStaticKeys(manifest, entryKey, staticKeys));
  const javascriptFiles = [...new Set([...staticKeys].map((key) => manifest[key].file)
    .filter((file) => file.endsWith(".js")))].toSorted();
  const assets = [...new Set([...staticKeys].flatMap((key) => [
    ...(manifest[key].assets ?? []), ...(manifest[key].css ?? []),
  ]))].toSorted();
  const lookup = (file) => {
    const item = filesByName.get(file);
    if (!item) throw new Error(`Vite manifest references missing file ${file}`);
    return item;
  };
  const javascript = javascriptFiles.map(lookup);
  const resources = assets.map(lookup);
  const all = [...javascript, ...resources];
  return {
    assets, resources, javascript,
    gzipBytes: javascript.reduce((total, item) => total + item.gzipBytes, 0),
    rawBytes: javascript.reduce((total, item) => total + item.rawBytes, 0),
    totalRawBytes: all.reduce((total, item) => total + item.rawBytes, 0),
    totalGzipBytes: all.reduce((total, item) => total + item.gzipBytes, 0),
  };
}

const options = parseArguments(process.argv.slice(2));
const manifest = JSON.parse(
  await readFile(path.join(options.distDir, ".vite", "manifest.json"), "utf8"),
);
const bootstrapKey = findEntryKey(
  manifest,
  (entry) => entry.isEntry === true,
  "HTML bootstrap entry",
);
const files = await inventory(options.distDir);
const filesByName = new Map(files.map((file) => [file.file, file]));
const bootstrap = summarizeRequestSet(
  filesByName,
  manifest,
  [bootstrapKey],
);
const routes = {};

for (const [label, source] of Object.entries(ROUTE_SOURCES)) {
  const routeKey = findEntryKey(
    manifest,
    (entry) => entry.src === source,
    `${label} route ${source}`,
  );
  routes[label] = summarizeRequestSet(
    filesByName,
    manifest,
    [bootstrapKey, routeKey],
  );
}

const hashes = new Map();
for (const file of files) {
  const matches = hashes.get(file.sha256) ?? [];
  matches.push(file.file);
  hashes.set(file.sha256, matches);
}
const sourceMaps = files.filter((item) => item.file.endsWith(".map")).map((item) => item.file);
const duplicateFiles = [...hashes.values()].filter((matches) => matches.length > 1);

process.stdout.write(`${JSON.stringify({
  bootstrap,
  bootstrapBudgetBytes: 75 * 1024,
  bootstrapWithinBudget: bootstrap.gzipBytes <= 75 * 1024,
  routes,
  distribution: {
    files,
    rawBytes: files.reduce((total, item) => total + item.rawBytes, 0),
    gzipBytes: files.reduce((total, item) => total + item.gzipBytes, 0),
    sourceMaps,
    duplicateFiles,
  },
}, null, 2)}\n`);
