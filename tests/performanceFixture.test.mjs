import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createPerformanceFixture } from "../scripts/performance/create-fixture.mjs";

test("performance fixtures are isolated, bounded, and mixed", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "mclip-performance-test-"));
  const fixture = await createPerformanceFixture({ count: 50, outputDir });
  const history = JSON.parse(await readFile(path.join(outputDir, "history.json"), "utf8"));

  assert.equal(fixture.fixtureRoot, outputDir);
  assert.equal(history.length, 50);
  assert.deepEqual(new Set(history.map((entry) => entry.kind)), new Set(["text", "files", "image"]));
  assert.ok(history.every((entry) => entry.sourceApp === null));
});

test("performance fixtures reject non-temporary and oversized targets", async () => {
  await assert.rejects(
    createPerformanceFixture({ count: 201 }),
    /between 0 and 200/,
  );
  await assert.rejects(
    createPerformanceFixture({ count: 10, outputDir: process.cwd() }),
    /must be inside/,
  );
});

test("macOS benchmark commands use LaunchServices for primary startup and retain fixture isolation", async () => {
  const [startupSource, interactionSource, launchSource, baseline] = await Promise.all([
    readFile("scripts/performance/benchmark-startup.mjs", "utf8"),
    readFile("scripts/performance/benchmark-interactions.mjs", "utf8"),
    readFile("scripts/performance/launch-app.mjs", "utf8"),
    readFile("performance/baseline-v0.1.1.json", "utf8").then(JSON.parse),
  ]);

  assert.match(startupSource, /\.app\/Contents\/MacOS\//);
  assert.match(interactionSource, /MCLIP_PERF_CONFIG_DIR: fixture\.fixtureRoot/);
  assert.match(interactionSource, /appOwnerPid = mainWindow\.ownerPid/);
  assert.match(launchSource, /\/usr\/bin\/open/);
  assert.match(launchSource, /--env/);
  assert.match(launchSource, /--mclip-performance-action=quit/);
  assert.equal(baseline.fixture.usesRealConfig, false);
  assert.equal(baseline.sampling.warmupRuns, 5);
  assert.equal(baseline.sampling.measuredRuns, 20);
  assert.equal(baseline.startup.rustTrayReadyMs.values.length, 20);
  assert.equal(baseline.status.coldStart, "captured");
  assert.equal(baseline.status.imageViewer, "captured");
  assert.equal(baseline.interactions.viewerShellMs.values.length, 20);
});
