import { spawn } from "node:child_process";

const command = process.platform === "win32" ? "astro.cmd" : "astro";
const args = process.argv.slice(2);

const child = spawn(command, args, {
  env: {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: "1",
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
