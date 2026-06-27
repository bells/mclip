import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public install scripts stay identical and prefer release binaries", async () => {
  const [rootScript, siteScript, releaseWorkflow] = await Promise.all([
    readFile("install.sh", "utf8"),
    readFile("site/public/install.sh", "utf8"),
    readFile(".github/workflows/release.yml", "utf8"),
  ]);

  assert.equal(siteScript, rootScript);
  assert.match(rootScript, /latest\/download/);
  assert.match(rootScript, /MCLIP_VERSION/);
  assert.match(rootScript, /download_prebuilt_binary/);
  assert.match(rootScript, /build_repo_binary/);
  assert.match(releaseWorkflow, /mclip-cli-\$\{\{ steps\.cli_asset\.outputs\.platform \}\}-\$\{\{ steps\.cli_asset\.outputs\.arch \}\}/);
  assert.match(releaseWorkflow, /softprops\/action-gh-release/);
});
