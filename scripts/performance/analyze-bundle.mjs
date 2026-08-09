import { readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const ROUTE_SOURCES = {
  about: "src/components/AboutWindow.tsx",
  "image-viewer": "src/components/FullscreenImageViewer.tsx",
  main: "src/App.tsx",
  preferences: "src/components/PreferencesWindow.tsx",
  preview: "src/components/HistoryPreviewWindow.tsx",
  "preview-detail": "src/components/HistoryPreviewDetailWindow.tsx",
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

async function summarizeRequestSet(distDir, manifest, entryKeys) {
  const staticKeys = new Set();
  entryKeys.forEach((entryKey) => collectStaticKeys(manifest, entryKey, staticKeys));
  const javascriptFiles = [...new Set(
    [...staticKeys]
      .map((entryKey) => manifest[entryKey].file)
      .filter((file) => file.endsWith(".js")),
  )].toSorted();
  const assets = [...new Set(
    [...staticKeys].flatMap((entryKey) => [
      ...(manifest[entryKey].assets ?? []),
      ...(manifest[entryKey].css ?? []),
    ]),
  )].toSorted();
  const sizes = await Promise.all(javascriptFiles.map(async (file) => {
    const bytes = await readFile(path.join(distDir, file));
    return {
      file,
      gzipBytes: gzipSync(bytes).byteLength,
      rawBytes: bytes.byteLength,
    };
  }));

  return {
    assets,
    gzipBytes: sizes.reduce((total, item) => total + item.gzipBytes, 0),
    javascript: sizes,
    rawBytes: sizes.reduce((total, item) => total + item.rawBytes, 0),
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
const bootstrap = await summarizeRequestSet(
  options.distDir,
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
  routes[label] = await summarizeRequestSet(
    options.distDir,
    manifest,
    [bootstrapKey, routeKey],
  );
}

process.stdout.write(`${JSON.stringify({
  bootstrap,
  bootstrapBudgetBytes: 75 * 1024,
  bootstrapWithinBudget: bootstrap.gzipBytes <= 75 * 1024,
  routes,
}, null, 2)}\n`);
