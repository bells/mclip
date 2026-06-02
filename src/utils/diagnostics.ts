import { writeClientLog } from "../lib/tauri";

let isClientLoggingInstalled = false;

export function installClientErrorLogging() {
  if (isClientLoggingInstalled) {
    return;
  }

  isClientLoggingInstalled = true;

  window.addEventListener("error", (event) => {
    void logClientError("window.error", event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    void logClientError("unhandledrejection", event.reason);
  });
}

export function logClientError(context: string, error: unknown) {
  return writeClientLog("error", formatErrorMessage(error), context).catch(() => {
    // Diagnostics must never create another visible failure path.
  });
}

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return [error.name, error.message, error.stack].filter(Boolean).join(" | ");
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
