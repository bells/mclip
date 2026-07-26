import type { CliInstallState } from "../types";

export type CliPrimaryAction = "install" | "upgrade" | "reinstall" | "none";

const CLI_ERROR_CODES = [
  "CLI_UNSUPPORTED_PLATFORM",
  "CLI_RELEASE_UNAVAILABLE",
  "CLI_CHECKSUM_UNAVAILABLE",
  "CLI_CHECKSUM_INVALID",
  "CLI_CHECKSUM_MISMATCH",
  "CLI_REPLACE_FAILED",
  "CLI_DESTINATION_UNSAFE",
  "CLI_INSTALL_BUSY",
  "CLI_POST_INSTALL_VERIFY_FAILED",
  "CLI_DOWNLOAD_TOO_LARGE",
  "CLI_DOWNLOAD_FAILED",
] as const;

export type CliInstallErrorCode = (typeof CLI_ERROR_CODES)[number] | "UNKNOWN";

export function getCliPrimaryAction(
  state: CliInstallState,
  platformSupported: boolean,
): CliPrimaryAction {
  if (!platformSupported) {
    return "none";
  }

  switch (state) {
    case "notInstalled":
      return "install";
    case "outdated":
    case "unknown":
      return "upgrade";
    case "current":
      return "reinstall";
    case "newer":
      return "none";
  }
}

export function getCliInstallErrorCode(error: unknown): CliInstallErrorCode {
  const message = error instanceof Error ? error.message : String(error);

  return (
    CLI_ERROR_CODES.find((code) => message.includes(`${code}:`)) ?? "UNKNOWN"
  );
}
