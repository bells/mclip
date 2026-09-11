import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const [baseline, candidate] = process.argv.slice(2);
if (!baseline || !candidate) throw new Error("Usage: compare-cli.mjs BASELINE CANDIDATE");
const directory = await mkdtemp(path.join(tmpdir(), "mclip-cli-compare-"));
try {
  const historyPath = path.join(directory, "history.json");
  const common = (id, timestamp) => ({ id, displayText: id, firstCopiedAt: 1,
    lastCopiedAt: timestamp, copyCount: 1, sourceApp: null, isPinned: false, pinnedAt: null });
  const history = [
    { ...common("ordinary", 4), kind: "text", text: "Hello 世界 ```fixture```" },
    { ...common("secret", 3), kind: "text", text: "synthetic classified secret", secretType: "openAiApiKey", secretDetectorVersion: 1 },
    { ...common("files", 2), kind: "files", filePaths: ["/synthetic/first.txt", "/synthetic/second.txt"] },
    { ...common("image", 1), kind: "image", imagePath: "/synthetic/image.png", width: 2, height: 2, byteSize: 4, contentHash: "synthetic" },
  ];
  await writeFile(historyPath, JSON.stringify(history));
  const run = (binary, args, input = "") => {
    const result = spawnSync(path.resolve(binary), ["--history-path", historyPath, ...args], {
      input, encoding: "utf8", timeout: 10000,
    });
    if (result.error) throw result.error;
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  };
  let comparisons = 0;
  const compare = (args, input) => {
    assert.deepEqual(run(candidate, args, input), run(baseline, args, input), `CLI mismatch: ${args.join(" ")}`);
    comparisons++;
  };
  for (const command of [["list"], ["get", "--index", "2"], ["search", "synthetic"], ["context"]]) {
    for (const format of ["text", "json", "markdown", "raw"]) {
      for (const reveal of [[], ["--reveal-secrets"]]) compare([...command, "--format", format, ...reveal]);
    }
  }
  for (const args of [["agent"], ["agent", "--json"], ["agent", "--json", "--reveal-secrets"],
    ["list", "--json", "--with-meta"], ["list", "--pinned"], ["list", "--kind", "files"],
    ["get", "--id", "missing"], ["--help"], ["--version"]]) compare(args);
  for (const [action, input] of [["json-minify", '{ "hello": "世界" }'], ["base64-encode", "世界"],
    ["base64-decode", "aGVsbG8="], ["url-component-encode", "a b/世界"],
    ["url-component-decode", "a%20b"], ["json-minify", "{"], ["url-component-decode", "%QQ"]]) {
    compare(["transform", action, "--stdin"], input);
  }
  const masked = run(candidate, ["get", "--index", "2", "--json"]);
  assert.equal(JSON.parse(masked.stdout).text, "••••••••");
  assert.equal(JSON.parse(run(candidate, ["get", "--index", "2", "--json", "--reveal-secrets"]).stdout).text, "synthetic classified secret");
  console.log(JSON.stringify({ comparisons, maskingVerified: true, fixture: "synthetic, no clipboard access" }));
} finally {
  await rm(directory, { recursive: true, force: true });
}
