import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIN_FIXTURE_SIZE = 0;
const MAX_FIXTURE_SIZE = 200;
const DEFAULT_FIXTURE_SIZE = 50;
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XqTzAAAAAElFTkSuQmCC",
  "base64",
);

function assertTemporaryOutput(outputDir) {
  const resolvedOutput = path.resolve(outputDir);
  const resolvedTmp = path.resolve(tmpdir());
  if (
    resolvedOutput !== resolvedTmp &&
    !resolvedOutput.startsWith(`${resolvedTmp}${path.sep}`)
  ) {
    throw new Error(`performance fixture output must be inside ${resolvedTmp}`);
  }
  return resolvedOutput;
}

function createCommon(index) {
  const copiedAt = 1_700_000_000_000 + index;
  return {
    copyCount: (index % 4) + 1,
    displayText: `fixture-${index}`,
    firstCopiedAt: copiedAt - 1_000,
    id: `perf-${index.toString().padStart(3, "0")}`,
    lastCopiedAt: copiedAt,
    sourceApp: null,
  };
}

export async function createPerformanceFixture({
  count = DEFAULT_FIXTURE_SIZE,
  outputDir,
} = {}) {
  if (!Number.isInteger(count) || count < MIN_FIXTURE_SIZE || count > MAX_FIXTURE_SIZE) {
    throw new Error(`fixture count must be an integer between 0 and ${MAX_FIXTURE_SIZE}`);
  }

  const fixtureRoot = assertTemporaryOutput(
    outputDir ?? await mkdtemp(path.join(tmpdir(), "mclip-performance-")),
  );
  const imageDir = path.join(fixtureRoot, "history-assets", "images");
  await mkdir(imageDir, { recursive: true });

  const imagePaths = [];
  for (let index = 0; index < 10; index += 1) {
    const imagePath = path.join(imageDir, `fixture-${index}.png`);
    await writeFile(imagePath, TINY_PNG);
    imagePaths.push(imagePath);
  }

  const history = Array.from({ length: count }, (_, index) => {
    const common = createCommon(index);
    switch (index % 3) {
      case 1:
        return {
          ...common,
          displayText: `fixture-${index}.txt`,
          filePaths: [path.join(fixtureRoot, "files", `fixture-${index}.txt`)],
          kind: "files",
        };
      case 2:
        return {
          ...common,
          byteSize: TINY_PNG.byteLength,
          contentHash: `fixture-image-${index % imagePaths.length}`,
          height: 1,
          imagePath: imagePaths[index % imagePaths.length],
          kind: "image",
          width: 1,
        };
      default:
        return {
          ...common,
          kind: "text",
          text: `mclip performance fixture ${index}`,
        };
    }
  });

  const settings = {
    appearanceTheme: "system",
    autoPaste: false,
    enabledHistoryTypes: { files: true, image: true, text: true },
    historyGroupItemCount: 10,
    language: "system",
    launchAtLogin: false,
    mainWindowItemCount: Math.min(10, Math.max(5, count || 10)),
    maxHistoryCount: Math.min(200, Math.max(10, count || 10)),
    menuBarIconStyle: "light",
    showHistoryItemNumbers: true,
    showMainWindowBrand: true,
  };

  await Promise.all([
    writeFile(path.join(fixtureRoot, "history.json"), `${JSON.stringify(history, null, 2)}\n`),
    writeFile(path.join(fixtureRoot, "settings.json"), `${JSON.stringify(settings, null, 2)}\n`),
  ]);

  return { count, fixtureRoot, history, settings };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--count") {
      options.count = Number(argv[index + 1]);
      index += 1;
    } else if (argv[index] === "--output") {
      options.outputDir = argv[index + 1];
      index += 1;
    }
  }
  return options;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const fixture = await createPerformanceFixture(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({ count: fixture.count, fixtureRoot: fixture.fixtureRoot })}\n`);
}
