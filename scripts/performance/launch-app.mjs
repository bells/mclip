import { execFile, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PERFORMANCE_QUIT_ARGUMENT = "--mclip-performance-action=quit";

function macAppBundle(binary) {
  const marker = ".app/Contents/MacOS/";
  const markerIndex = binary.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error("macOS performance runs require a bundled .app binary");
  }
  return binary.slice(0, markerIndex + ".app".length);
}

export function spawnPerformanceApp(binary, performanceEnvironment) {
  if (process.platform !== "darwin") {
    return spawn(binary, [], {
      env: { ...process.env, ...performanceEnvironment },
      stdio: "ignore",
    });
  }

  const environmentArguments = Object.entries(performanceEnvironment).flatMap(
    ([name, value]) => ["--env", `${name}=${value}`],
  );
  return spawn(
    "/usr/bin/open",
    ["-n", "-g", "-W", ...environmentArguments, macAppBundle(binary)],
    { stdio: "ignore" },
  );
}

export async function stopPerformanceApp(binary, child) {
  if (child.exitCode !== null) return;

  try {
    await execFileAsync(binary, [PERFORMANCE_QUIT_ARGUMENT], { timeout: 5_000 });
  } catch {
    // The primary process may already have exited after a failed startup.
  }

  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGTERM");
}
