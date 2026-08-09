import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createPerformanceFixture } from "./create-fixture.mjs";
import { spawnPerformanceApp, stopPerformanceApp } from "./launch-app.mjs";

function parseArguments(argv) {
  const options = { count: 50, runs: 20, warmups: 5 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index + 1];
    switch (argv[index]) {
      case "--binary": options.binary = value; index += 1; break;
      case "--count": options.count = Number(value); index += 1; break;
      case "--output": options.output = value; index += 1; break;
      case "--runs": options.runs = Number(value); index += 1; break;
      case "--warmups": options.warmups = Number(value); index += 1; break;
      default: break;
    }
  }
  return options;
}

function percentile(values, percentileValue) {
  const sorted = values.toSorted((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue / 100) - 1)];
}

async function waitForMilestone(tracePath, milestone, timeoutMs = 15_000) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    try {
      const trace = await readFile(tracePath, "utf8");
      if (trace.includes(`"milestone":"${milestone}"`)) {
        return trace;
      }
    } catch {
      // The writer creates the file after the first milestone.
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for ${milestone} in ${tracePath}`);
}

async function triggerSingleInstanceMainShow(binary) {
  const launcherEnvironment = { ...process.env };
  delete launcherEnvironment.MCLIP_PERF_CONFIG_DIR;
  delete launcherEnvironment.MCLIP_PERF_FIXTURE_SIZE;
  delete launcherEnvironment.MCLIP_PERF_MODE;
  delete launcherEnvironment.MCLIP_PERF_TRACE_PATH;

  const launcher = spawn(binary, [], {
    env: launcherEnvironment,
    stdio: "ignore",
  });
  await Promise.race([
    new Promise((resolve, reject) => {
      launcher.once("error", reject);
      launcher.once("exit", (code, signal) => {
        if (code === 0 || signal === "SIGTERM") {
          resolve();
          return;
        }
        reject(new Error(`single-instance launcher exited with code=${code} signal=${signal}`));
      });
    }),
    new Promise((_, reject) => setTimeout(
      () => reject(new Error("single-instance launcher timed out")),
      5_000,
    )),
  ]);
}

async function runOnce({ binary, count, fixtureRoot, tracePath }) {
  const externalStartedAt = performance.now();
  const child = spawnPerformanceApp(binary, {
    MCLIP_PERF_CONFIG_DIR: fixtureRoot,
    MCLIP_PERF_FIXTURE_SIZE: String(count),
    MCLIP_PERF_MODE: "1",
    MCLIP_PERF_TRACE_PATH: tracePath,
  });

  try {
    await waitForMilestone(tracePath, "trayReady");
    const launcherCompletion = triggerSingleInstanceMainShow(binary).then(
      () => null,
      (error) => error,
    );
    const trace = await waitForMilestone(tracePath, "historyReady");
    const externalHistoryReadyMs = performance.now() - externalStartedAt;
    const launcherError = await launcherCompletion;
    if (launcherError) throw launcherError;
    await new Promise((resolve) => setTimeout(resolve, 50));
    const milestones = trace.trim().split(/\r?\n/).map((line) => JSON.parse(line));
    const trayReady = milestones.find(
      (entry) => entry.clock === "rust" && entry.milestone === "trayReady",
    );
    const historyReady = milestones.find(
      (entry) => entry.clock === "frontend" && entry.milestone === "historyReady",
    );
    if (!trayReady || !historyReady) {
      throw new Error("startup trace is missing trayReady or historyReady");
    }
    return {
      externalHistoryReadyMs,
      frontendHistoryReadyMs: historyReady.elapsedMs,
      rustTrayReadyMs: trayReady.elapsedMs,
    };
  } finally {
    await stopPerformanceApp(binary, child);
  }
}

const options = parseArguments(process.argv.slice(2));
if (!options.binary || !path.isAbsolute(options.binary)) {
  throw new Error("--binary must be an absolute release binary path");
}
if (process.platform === "darwin" && !options.binary.includes(".app/Contents/MacOS/")) {
  throw new Error("macOS performance runs require a bundled .app binary so WebView assets resolve");
}
if (![options.count, options.runs, options.warmups].every(Number.isInteger)) {
  throw new Error("count, runs, and warmups must be integers");
}

const benchmarkRoot = await mkdir(
  path.join(tmpdir(), `mclip-performance-benchmark-${process.pid}`),
  { recursive: true },
).then(() => path.join(tmpdir(), `mclip-performance-benchmark-${process.pid}`));
const fixture = await createPerformanceFixture({
  count: options.count,
  outputDir: path.join(benchmarkRoot, "fixture"),
});

const total = options.warmups + options.runs;
const measured = [];
for (let index = 0; index < total; index += 1) {
  const tracePath = path.join(benchmarkRoot, `trace-${index}.jsonl`);
  const result = await runOnce({
    binary: options.binary,
    count: options.count,
    fixtureRoot: fixture.fixtureRoot,
    tracePath,
  });
  if (index >= options.warmups) {
    measured.push(result);
  }
  process.stderr.write(`startup run ${index + 1}/${total}\n`);
}

const metrics = {};
for (const key of ["rustTrayReadyMs", "frontendHistoryReadyMs", "externalHistoryReadyMs"]) {
  const values = measured.map((entry) => entry[key]);
  metrics[key] = {
    medianMs: percentile(values, 50),
    p95Ms: percentile(values, 95),
    values,
  };
}

const report = {
  architecture: "main-only-startup-dynamic-auxiliary-webviews",
  binary: options.binary,
  fixtureSize: options.count,
  measuredRuns: options.runs,
  metrics,
  platform: `${process.platform}-${process.arch}`,
  warmupRuns: options.warmups,
};
const outputPath = options.output ?? path.join(benchmarkRoot, "startup-report.json");
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ outputPath, metrics }, null, 2)}\n`);
