import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("bundle analysis covers all windows, shared resources, maps and duplicate bytes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mclip-bundle-test-"));
  try {
    await mkdir(path.join(directory, ".vite"));
    const sources = [
      "src/App.tsx", "src/components/AboutWindow.tsx",
      "src/components/FullscreenImageViewer.tsx", "src/components/PreferencesWindow.tsx",
      "src/components/HistoryPreviewWindow.tsx", "src/components/HistoryPreviewDetailWindow.tsx",
      "src/components/QuickActionWindow.tsx",
    ];
    const manifest = {
      "index.html": { isEntry: true, file: "bootstrap.js", css: ["shared.css"] },
      shared: { file: "shared.js", assets: ["icon.png"] },
    };
    const files = { "bootstrap.js": "bootstrap", "shared.js": "shared", "shared.css": "css",
      "icon.png": "synthetic image", "duplicate.png": "synthetic image", "orphan.js.map": "{}" };
    for (const [index, src] of sources.entries()) {
      manifest[src] = { src, file: `route-${index}.js`, imports: ["shared"], css: ["shared.css"] };
      files[`route-${index}.js`] = `route ${index}`;
    }
    for (const [file, bytes] of Object.entries(files)) await writeFile(path.join(directory, file), bytes);
    await writeFile(path.join(directory, ".vite/manifest.json"), JSON.stringify(manifest));
    const run = () => spawnSync(process.execPath,
      ["scripts/performance/analyze-bundle.mjs", "--dist-dir", directory], { encoding: "utf8" });
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(Object.keys(report.routes).length, 7);
    assert.ok(report.routes["quick-action"]);
    assert.deepEqual(report.distribution.sourceMaps, ["orphan.js.map"]);
    assert.deepEqual(report.distribution.duplicateFiles, [["duplicate.png", "icon.png"]]);
    assert.deepEqual(report.routes.main.assets, ["icon.png", "shared.css"]);
    assert.equal(report.routes.main.totalRawBytes, "bootstrapsharedroute 0csssynthetic image".length);
    assert.equal(report.distribution.rawBytes,
      report.distribution.files.reduce((sum, file) => sum + file.rawBytes, 0));
    await rm(path.join(directory, "icon.png"));
    const missing = run();
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /references missing file icon.png/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
