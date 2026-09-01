import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const sourcePath = join(projectRoot, "src-tauri/icons/menu-bar-icon-m.svg");
const runtimePath = join(projectRoot, "src-tauri/icons/menu-bar-icon-m.png");
const preferencesPath = join(
  projectRoot,
  "src-tauri/icons/menu-bar-icon-m-128.png",
);
const previewPath = join(tmpdir(), "mclip-menu-bar-m-size-preview.svg");
const tauriCliPath = require.resolve("@tauri-apps/cli/tauri.js");
const requestedSizes = [16, 18, 22, 128, 512];

function assertSourceContract(source) {
  for (const marker of [
    'viewBox="0 0 24 24"',
    'data-icon-part="notebook"',
    'data-icon-part="binding"',
    'data-icon-part="letter-m"',
  ]) {
    if (!source.includes(marker)) {
      throw new Error(`canonical SVG is missing ${marker}`);
    }
  }

  if (/<(?:text|filter|linearGradient|radialGradient)\b/u.test(source)) {
    throw new Error("canonical SVG must use explicit monochrome vector geometry");
  }
}

function readPngContract(path, expectedSize) {
  const png = readFileSync(path);
  const signature = "89504e470d0a1a0a";
  if (png.subarray(0, 8).toString("hex") !== signature) {
    throw new Error(`${path} is not a PNG`);
  }

  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const colorType = png.readUInt8(25);
  if (width !== expectedSize || height !== expectedSize) {
    throw new Error(`${path} must be ${expectedSize}x${expectedSize}`);
  }
  if (colorType !== 4 && colorType !== 6) {
    throw new Error(`${path} must retain an alpha channel`);
  }

  return png;
}

function createPreview(generatedDir) {
  const columns = [
    { size: 16, scale: 8 },
    { size: 18, scale: 7 },
    { size: 22, scale: 6 },
  ];
  const rows = [
    { label: "Light menu bar", fill: "#f4f1e8", filter: "" },
    { label: "Dark menu bar", fill: "#24261f", filter: ' filter="url(#template-dark)"' },
  ];

  const cells = rows.flatMap((row, rowIndex) =>
    columns.map(({ size, scale }, columnIndex) => {
      const pngPath = join(generatedDir, `${size}x${size}.png`);
      const png = readPngContract(pngPath, size);
      const displaySize = size * scale;
      const cellX = 220 + columnIndex * 200;
      const cellY = 82 + rowIndex * 150;
      const imageX = cellX + (144 - displaySize) / 2;
      const imageY = cellY + (112 - displaySize) / 2;
      return `
        <g>
          <rect x="${cellX}" y="${cellY}" width="144" height="112" rx="18" fill="${row.fill}" />
          <image x="${imageX}" y="${imageY}" width="${displaySize}" height="${displaySize}"
            href="data:image/png;base64,${png.toString("base64")}" image-rendering="pixelated"${row.filter} />
          <text x="${cellX + 72}" y="${cellY + 132}" text-anchor="middle" class="size">${size}×${size}</text>
        </g>`;
    }),
  );

  const rowLabels = rows
    .map(
      (row, index) =>
        `<text x="36" y="${145 + index * 150}" class="row-label">${row.label}</text>`,
    )
    .join("\n");

  const preview = `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="390" viewBox="0 0 840 390">
    <defs>
      <filter id="template-dark" color-interpolation-filters="sRGB">
        <feColorMatrix type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0" />
      </filter>
      <style>
        .title { fill: #171914; font: 700 24px -apple-system, BlinkMacSystemFont, sans-serif; }
        .subtitle, .size { fill: #676b60; font: 500 14px -apple-system, BlinkMacSystemFont, sans-serif; }
        .row-label { fill: #34372f; font: 650 15px -apple-system, BlinkMacSystemFont, sans-serif; }
      </style>
    </defs>
    <rect width="840" height="390" rx="24" fill="#ffffff" />
    <text x="36" y="42" class="title">mclip notebook + m status icon</text>
    <text x="36" y="66" class="subtitle">True 16 / 18 / 22 px rasters, enlarged with nearest-neighbor sampling</text>
    ${rowLabels}
    ${cells.join("\n")}
  </svg>`;

  writeFileSync(previewPath, preview);
}

const canonicalSource = readFileSync(sourcePath, "utf8");
assertSourceContract(canonicalSource);

const temporaryRoot = mkdtempSync(join(tmpdir(), "mclip-menu-bar-icon-"));
const generatedDir = join(temporaryRoot, "generated");
mkdirSync(generatedDir);

try {
  const args = ["icon", sourcePath, "--output", generatedDir];
  for (const size of requestedSizes) {
    args.push("--png", String(size));
  }

  const result = spawnSync(process.execPath, [tauriCliPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `Tauri icon generation failed:\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }

  const runtimeGenerated = join(generatedDir, "512x512.png");
  const preferencesGenerated = join(generatedDir, "128x128.png");
  readPngContract(runtimeGenerated, 512);
  readPngContract(preferencesGenerated, 128);
  copyFileSync(runtimeGenerated, runtimePath);
  copyFileSync(preferencesGenerated, preferencesPath);
  createPreview(generatedDir);
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}

console.log(`Generated ${runtimePath}`);
console.log(`Generated ${preferencesPath}`);
console.log(`Generated ${previewPath}`);
