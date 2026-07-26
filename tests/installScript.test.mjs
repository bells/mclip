import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const installerPath = path.resolve("install.sh");

async function writeExecutable(pathname, source) {
  await writeFile(pathname, source, "utf8");
  await chmod(pathname, 0o755);
}

async function createInstallerFixture({
  checksumMode = "valid",
  downloadMode = "success",
  existingBinary = null,
  version = null,
} = {}) {
  const fixtureDir = await mkdtemp(path.join(tmpdir(), "mclip-installer-"));
  const fakeBinDir = path.join(fixtureDir, "fake-bin");
  const installDir = path.join(fixtureDir, "install");
  const binaryPath = path.join(fixtureDir, "release-binary");
  const checksumPath = path.join(fixtureDir, "release-binary.sha256");
  const curlLogPath = path.join(fixtureDir, "curl.log");
  const installedPath = path.join(installDir, "mclip-cli");
  const binary = "mclip-cli fixture 0.1.1\n";
  const digest = crypto.createHash("sha256").update(binary).digest("hex");
  const checksum =
    checksumMode === "valid"
      ? `${digest}  mclip-cli-darwin-arm64\n`
      : checksumMode === "mismatch"
        ? `${"0".repeat(64)}  mclip-cli-darwin-arm64\n`
        : "not-a-checksum\n";

  await mkdir(fakeBinDir);
  await mkdir(installDir);
  await writeFile(binaryPath, binary, "utf8");
  await writeFile(checksumPath, checksum, "utf8");

  if (existingBinary !== null) {
    await writeFile(installedPath, existingBinary, "utf8");
  }

  await writeExecutable(
    path.join(fakeBinDir, "uname"),
    `#!/bin/sh
if [ "\${1:-}" = "-s" ]; then
  printf 'Darwin\\n'
else
  printf 'arm64\\n'
fi
`,
  );
  await writeExecutable(
    path.join(fakeBinDir, "curl"),
    `#!/bin/sh
url=""
output=""
write_status=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o)
      output="$2"
      shift 2
      ;;
    -w)
      write_status=true
      shift 2
      ;;
    http*)
      url="$1"
      shift
      ;;
    *)
      shift
      ;;
  esac
done
printf '%s\\n' "$url" >> "$FAKE_CURL_LOG"
if [ "$FAKE_DOWNLOAD_MODE" = "missing-binary" ] && [ "\${url##*.}" != "sha256" ]; then
  [ "$write_status" = false ] || printf '404'
  exit 22
fi
if [ "$FAKE_DOWNLOAD_MODE" = "network-error" ] && [ "\${url##*.}" != "sha256" ]; then
  [ "$write_status" = false ] || printf '000'
  exit 6
fi
if [ "\${url##*.}" = "sha256" ]; then
  [ "$FAKE_CHECKSUM_MODE" != "missing" ] || exit 22
  cp "$FAKE_CHECKSUM" "$output"
else
  cp "$FAKE_BINARY" "$output"
fi
[ "$write_status" = false ] || printf '200'
`,
  );
  await writeExecutable(
    path.join(fakeBinDir, "cargo"),
    `#!/bin/sh
mkdir -p "$FAKE_REPO_DIR/src-tauri/target/release"
cp "$FAKE_BINARY" "$FAKE_REPO_DIR/src-tauri/target/release/mclip-cli"
`,
  );

  if (downloadMode === "missing-binary") {
    await mkdir(path.join(fixtureDir, "src-tauri"));
    await writeFile(path.join(fixtureDir, "src-tauri", "Cargo.toml"), "[package]\n");
  }

  const result = spawnSync("sh", [installerPath], {
    cwd: fixtureDir,
    encoding: "utf8",
    env: {
      ...process.env,
      FAKE_BINARY: binaryPath,
      FAKE_CHECKSUM: checksumPath,
      FAKE_CHECKSUM_MODE: checksumMode,
      FAKE_CURL_LOG: curlLogPath,
      FAKE_DOWNLOAD_MODE: downloadMode,
      FAKE_REPO_DIR: fixtureDir,
      MCLIP_INSTALL_DIR: installDir,
      MCLIP_RELEASE_BASE_URL: "https://releases.example.test",
      PATH: `${fakeBinDir}:${process.env.PATH}`,
      ...(version ? { MCLIP_VERSION: version } : {}),
    },
  });

  return {
    curlLog: await readFile(curlLogPath, "utf8").catch(() => ""),
    installedPath,
    result,
  };
}

test("public install scripts stay identical and publish checksum assets", async () => {
  const [rootScript, siteScript, releaseWorkflow] = await Promise.all([
    readFile("install.sh", "utf8"),
    readFile("site/public/install.sh", "utf8"),
    readFile(".github/workflows/release.yml", "utf8"),
  ]);

  assert.equal(siteScript, rootScript);
  assert.match(rootScript, /latest\/download/);
  assert.match(rootScript, /MCLIP_VERSION/);
  assert.match(rootScript, /verify_checksum/);
  assert.match(rootScript, /sha256sum|shasum/);
  assert.match(rootScript, /build_repo_binary/);
  assert.match(releaseWorkflow, /ASSET_NAME="mclip-cli-darwin-arm64"/);
  assert.match(releaseWorkflow, /ASSET_NAME="mclip-cli-windows-x64\.exe"/);
  assert.match(releaseWorkflow, /asset_name \}\}\.sha256/);
  assert.match(releaseWorkflow, /mclip-cli \$TAG_VERSION/);
});

test("installer verifies latest release before replacing an existing CLI", async () => {
  const fixture = await createInstallerFixture({ existingBinary: "old cli\n" });

  assert.equal(fixture.result.status, 0, fixture.result.stderr);
  assert.equal(
    await readFile(fixture.installedPath, "utf8"),
    "mclip-cli fixture 0.1.1\n",
  );
  assert.match(
    fixture.curlLog,
    /\/latest\/download\/mclip-cli-darwin-arm64\n/,
  );
  assert.match(
    fixture.curlLog,
    /\/latest\/download\/mclip-cli-darwin-arm64\.sha256\n/,
  );
  assert.match(fixture.result.stdout, /is not on PATH yet/);
});

test("installer pins binary and checksum to the requested version", async () => {
  const fixture = await createInstallerFixture({ version: "0.1.1" });

  assert.equal(fixture.result.status, 0, fixture.result.stderr);
  assert.match(
    fixture.curlLog,
    /\/download\/v0\.1\.1\/mclip-cli-darwin-arm64\n/,
  );
  assert.match(
    fixture.curlLog,
    /\/download\/v0\.1\.1\/mclip-cli-darwin-arm64\.sha256\n/,
  );
});

for (const checksumMode of ["missing", "malformed", "mismatch"]) {
  test(`installer preserves the existing CLI for ${checksumMode} checksum`, async () => {
    const fixture = await createInstallerFixture({
      checksumMode,
      existingBinary: "old cli\n",
    });

    assert.notEqual(fixture.result.status, 0);
    assert.equal(await readFile(fixture.installedPath, "utf8"), "old cli\n");
  });
}

test("missing prebuilt binary falls back to a local source build", async () => {
  const fixture = await createInstallerFixture({
    downloadMode: "missing-binary",
  });

  assert.equal(fixture.result.status, 0, fixture.result.stderr);
  assert.equal(
    await readFile(fixture.installedPath, "utf8"),
    "mclip-cli fixture 0.1.1\n",
  );
  assert.match(fixture.result.stdout, /falling back to local\/source build/);
});

test("network failure does not fall back or replace an existing CLI", async () => {
  const fixture = await createInstallerFixture({
    downloadMode: "network-error",
    existingBinary: "old cli\n",
  });

  assert.notEqual(fixture.result.status, 0);
  assert.equal(await readFile(fixture.installedPath, "utf8"), "old cli\n");
  assert.match(fixture.result.stderr, /unable to download the prebuilt CLI/);
  assert.doesNotMatch(fixture.result.stdout, /falling back/);
});
