export type LatestReleaseInfo = {
  releaseUrl: string;
  version: string;
};

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
};

export function normalizeReleaseVersion(version: string) {
  return version.trim().replace(/^[vV]/, "");
}

function parseSemanticVersion(version: string): ParsedVersion | null {
  const normalizedVersion = normalizeReleaseVersion(version);
  const [coreVersion] = normalizedVersion.split("-");
  const parts = coreVersion.split(".");

  if (parts.length !== 3) {
    return null;
  }

  if (!parts.every((part) => /^\d+$/.test(part))) {
    return null;
  }

  const [major, minor, patch] = parts.map((part) => Number(part));

  if (![major, minor, patch].every(Number.isInteger)) {
    return null;
  }

  return { major, minor, patch };
}

export function isReleaseNewer(latestVersion: string, currentVersion: string) {
  const latest = parseSemanticVersion(latestVersion);
  const current = parseSemanticVersion(currentVersion);

  if (!latest || !current) {
    return false;
  }

  for (const key of ["major", "minor", "patch"] as const) {
    if (latest[key] > current[key]) {
      return true;
    }

    if (latest[key] < current[key]) {
      return false;
    }
  }

  return false;
}

export function parseGitHubLatestReleaseResponse(
  response: unknown,
): LatestReleaseInfo | null {
  if (!response || typeof response !== "object") {
    return null;
  }

  const release = response as { html_url?: unknown; tag_name?: unknown };

  if (typeof release.tag_name !== "string" || release.tag_name.trim() === "") {
    return null;
  }

  if (typeof release.html_url !== "string" || release.html_url.trim() === "") {
    return null;
  }

  return {
    releaseUrl: release.html_url,
    version: normalizeReleaseVersion(release.tag_name),
  };
}
