import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { cpus, platform, release, tmpdir, totalmem } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { createPerformanceFixture } from "./create-fixture.mjs";
import { spawnPerformanceApp, stopPerformanceApp } from "./launch-app.mjs";

const execFileAsync = promisify(execFile);
const POLL_INTERVAL_MS = 10;
const PERFORMANCE_ACTION_ARGUMENTS = {
  closeViewer: "--mclip-performance-action=close-viewer",
  openViewer: "--mclip-performance-action=open-viewer",
};

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

function summarize(values) {
  return {
    medianMs: percentile(values, 50),
    p95Ms: percentile(values, 95),
    values,
  };
}

async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readTrace(tracePath) {
  try {
    const text = await readFile(tracePath, "utf8");
    return text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function waitForTrace(tracePath, predicate, description, timeoutMs = 15_000) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const records = await readTrace(tracePath);
    const result = predicate(records);
    if (result) {
      return result;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`timed out waiting for ${description}`);
}

function interactionAfter(records, startIndex, requestMilestone, completionMilestones, windowLabel) {
  const laterRecords = records.slice(startIndex);
  const requests = laterRecords.filter((entry) =>
    entry.clock === "rust" &&
    entry.milestone === requestMilestone &&
    entry.windowLabel === windowLabel &&
    entry.interactionId,
  );

  for (const request of requests) {
    const completions = Object.fromEntries(completionMilestones.map((milestone) => [
      milestone,
      laterRecords.find((entry) =>
        entry.clock === "rust" &&
        entry.milestone === milestone &&
        entry.windowLabel === windowLabel &&
        entry.interactionId === request.interactionId &&
        entry.elapsedMs >= request.elapsedMs,
      ),
    ]));
    if (Object.values(completions).every(Boolean)) {
      return Object.fromEntries(Object.entries(completions).map(([milestone, completion]) => [
        milestone,
        completion.elapsedMs - request.elapsedMs,
      ]));
    }
  }
  return null;
}

function cleanLauncherEnvironment() {
  const environment = { ...process.env };
  delete environment.MCLIP_PERF_CONFIG_DIR;
  delete environment.MCLIP_PERF_FIXTURE_SIZE;
  delete environment.MCLIP_PERF_MODE;
  delete environment.MCLIP_PERF_TRACE_PATH;
  return environment;
}

async function triggerSingleInstance(binary, action = null) {
  const arguments_ = action ? [PERFORMANCE_ACTION_ARGUMENTS[action]] : [];
  await execFileAsync(binary, arguments_, {
    env: cleanLauncherEnvironment(),
    timeout: 5_000,
  });
}

async function helperCommand(helper, ...arguments_) {
  const { stdout } = await execFileAsync(helper, arguments_);
  return stdout;
}

async function windows(helper) {
  return JSON.parse(await helperCommand(helper, "windows"));
}

async function findWindow(helper, ownerPid, name) {
  return (await windows(helper)).find(
    (window) => (ownerPid === null || window.ownerPid === ownerPid) && window.name === name,
  ) ?? null;
}

async function waitForWindow(helper, ownerPid, name, visible, timeoutMs = 5_000) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const window = await findWindow(helper, ownerPid, name);
    if (Boolean(window) === visible) {
      return window;
    }
    await sleep(20);
  }
  throw new Error(`timed out waiting for ${name} visible=${visible}`);
}

async function moveToMainHeader(helper, mainWindow) {
  await helperCommand(
    helper,
    "move",
    String(mainWindow.x + mainWindow.width / 2),
    String(mainWindow.y + 25),
  );
  await sleep(80);
}

async function moveToFixtureRow(helper, mainWindow, kind) {
  const rowCenterOffsets = { text: 71, files: 103, image: 151 };
  await helperCommand(
    helper,
    "move",
    String(mainWindow.x + mainWindow.width / 2),
    String(mainWindow.y + rowCenterOffsets[kind]),
  );
}

async function runInteraction({
  completionMilestones,
  requestMilestone,
  tracePath,
  trigger,
  windowLabel,
}) {
  const startIndex = (await readTrace(tracePath)).length;
  const triggerCompletion = Promise.resolve().then(trigger).then(
    () => null,
    (error) => error,
  );
  const result = await waitForTrace(
    tracePath,
    (records) => interactionAfter(
      records,
      startIndex,
      requestMilestone,
      completionMilestones,
      windowLabel,
    ),
    `${requestMilestone} -> ${completionMilestones.join(", ")}`,
  );
  const triggerError = await triggerCompletion;
  if (triggerError) throw triggerError;
  return result;
}

async function swiftCompilerArguments(source, output, moduleCache) {
  const sdkCandidates = [
    "/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk",
    "/Library/Developer/CommandLineTools/SDKs/MacOSX15.sdk",
  ];
  for (const sdk of sdkCandidates) {
    try {
      await access(sdk);
      return [
        "-sdk", sdk,
        "-target", `${process.arch === "x64" ? "x86_64" : "arm64"}-apple-macos15.0`,
        "-module-cache-path", moduleCache,
        source,
        "-o", output,
      ];
    } catch {
      // Try the next installed SDK before falling back to the active toolchain.
    }
  }
  return ["-module-cache-path", moduleCache, source, "-o", output];
}

const options = parseArguments(process.argv.slice(2));
if (platform() !== "darwin") {
  throw new Error("interaction automation currently requires macOS CoreGraphics");
}
if (!options.binary || !path.isAbsolute(options.binary)) {
  throw new Error("--binary must be an absolute release binary path");
}
if (!options.binary.includes(".app/Contents/MacOS/")) {
  throw new Error("macOS performance runs require a bundled .app binary so WebView assets resolve");
}
if (![options.count, options.runs, options.warmups].every(Number.isInteger)) {
  throw new Error("count, runs, and warmups must be integers");
}

const benchmarkRoot = path.join(tmpdir(), `mclip-performance-interactions-${process.pid}`);
await mkdir(benchmarkRoot, { recursive: true });
const fixture = await createPerformanceFixture({
  count: options.count,
  outputDir: path.join(benchmarkRoot, "fixture"),
});
const tracePath = path.join(benchmarkRoot, "trace.jsonl");
const helper = path.join(benchmarkRoot, "mclip-macos-input");
const helperSource = path.resolve("scripts/performance/macos-input.swift");
await execFileAsync("swiftc", await swiftCompilerArguments(
  helperSource,
  helper,
  path.join(benchmarkRoot, "swift-module-cache"),
));

const child = spawnPerformanceApp(options.binary, {
  MCLIP_PERF_CONFIG_DIR: fixture.fixtureRoot,
  MCLIP_PERF_FIXTURE_SIZE: String(options.count),
  MCLIP_PERF_MODE: "1",
  MCLIP_PERF_TRACE_PATH: tracePath,
});
let appOwnerPid = null;

const samples = {
  fileDetailShellMs: [],
  imageDetailReadyMs: [],
  imageDetailShellMs: [],
  mainShellMs: [],
  textDetailShellMs: [],
  viewerImageReadyMs: [],
  viewerShellMs: [],
};

try {
  await waitForTrace(
    tracePath,
    (records) => records.some((entry) => entry.clock === "rust" && entry.milestone === "trayReady"),
    "trayReady",
  );
  const startupLauncher = triggerSingleInstance(options.binary).then(
    () => null,
    (error) => error,
  );
  await waitForTrace(
    tracePath,
    (records) => records.some((entry) => entry.clock === "rust" && entry.milestone === "historyReady"),
    "historyReady Rust receipt",
  );
  const startupLauncherError = await startupLauncher;
  if (startupLauncherError) throw startupLauncherError;
  let mainWindow = await waitForWindow(helper, null, "mclip", true);
  appOwnerPid = mainWindow.ownerPid;
  const total = options.warmups + options.runs;

  for (let index = 0; index < total; index += 1) {
    const measured = index >= options.warmups;
    const main = await runInteraction({
      completionMilestones: ["mainPainted"],
      requestMilestone: "mainShowRequest",
      tracePath,
      trigger: () => triggerSingleInstance(options.binary),
      windowLabel: "main",
    });
    if (measured) samples.mainShellMs.push(main.mainPainted);
    mainWindow = await waitForWindow(helper, appOwnerPid, "mclip", true);

    for (const scenario of [
      { kind: "text", metric: "textDetailShellMs" },
      { kind: "files", metric: "fileDetailShellMs" },
      { kind: "image", metric: "imageDetailShellMs" },
    ]) {
      await moveToMainHeader(helper, mainWindow);
      const completionMilestones = scenario.kind === "image"
        ? ["previewPainted", "imageReady"]
        : ["previewPainted"];
      const detail = await runInteraction({
        completionMilestones,
        requestMilestone: "previewRequest",
        tracePath,
        trigger: () => moveToFixtureRow(helper, mainWindow, scenario.kind),
        windowLabel: "preview",
      });
      if (measured) {
        samples[scenario.metric].push(detail.previewPainted);
        if (scenario.kind === "image") samples.imageDetailReadyMs.push(detail.imageReady);
      }
    }

    const viewer = await runInteraction({
      completionMilestones: ["viewerPainted", "imageReady"],
      requestMilestone: "viewerRequest",
      tracePath,
      trigger: () => triggerSingleInstance(options.binary, "openViewer"),
      windowLabel: "image-viewer",
    });
    if (measured) {
      samples.viewerShellMs.push(viewer.viewerPainted);
      samples.viewerImageReadyMs.push(viewer.imageReady);
    }
    await waitForWindow(helper, appOwnerPid, "mclip image viewer", true);
    await triggerSingleInstance(options.binary, "closeViewer");
    await waitForWindow(helper, appOwnerPid, "mclip image viewer", false);
    process.stderr.write(`interaction run ${index + 1}/${total}\n`);
  }
} finally {
  await stopPerformanceApp(options.binary, child);
}

const metrics = Object.fromEntries(
  Object.entries(samples).map(([name, values]) => [name, summarize(values)]),
);
const report = {
  architecture: "main-only-startup-dynamic-auxiliary-webviews",
  binary: options.binary,
  device: {
    cpu: cpus()[0]?.model ?? "unknown",
    cpuCount: cpus().length,
    memoryBytes: totalmem(),
    osRelease: release(),
  },
  fixtureSize: options.count,
  measuredRuns: options.runs,
  metrics,
  platform: `${platform()}-${process.arch}`,
  warmupRuns: options.warmups,
};
const outputPath = options.output ?? path.join(benchmarkRoot, "interaction-report.json");
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ outputPath, metrics }, null, 2)}\n`);
