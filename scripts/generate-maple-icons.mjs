import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MAPLE_CONTRAST_BORDER, MAPLE_CONTRAST_SURFACE } from "./maple-icon-palette.mjs";
import { canonicalizeIcns } from "./icon-container.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const icons = join(projectRoot, "src-tauri/icons");
const sourcePath = join(icons, "source/maple-app.png");
const cli = createRequire(import.meta.url).resolve("@tauri-apps/cli/tauri.js");
const previewPath = join(tmpdir(), "mclip-maple-icon-preview.png");
const sizes = [16, 18, 22, 32, 64, 128, 256, 512, 1024];

function generate(source, output, requestedSizes = []) {
  const args = [cli, "icon", source, "--output", output];
  for (const size of requestedSizes) args.push("--png", String(size));
  const result = spawnSync(process.execPath, args, { cwd: projectRoot, encoding: "utf8", timeout: 120_000 });
  if (result.status !== 0) throw new Error(`Tauri icon export failed: ${result.stderr ?? result.error ?? result.stdout}`);
}

function dataUrl(path) {
  return `data:image/png;base64,${readFileSync(path).toString("base64")}`;
}

function templateSvg(source, size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
    <defs><filter id="white" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/></filter></defs>
    <image width="${size}" height="${size}" href="${dataUrl(source)}" filter="url(#white)"/>
  </svg>`;
}

function createPreview(colorDir, templateDir, contrastPath, temporaryRoot) {
  const panels = [
    { title: "Color · appIcon", path: join(colorDir, "256x256.png"), surface: "#f2f3f5", filter: "" },
    { title: "Template · light", path: join(templateDir, "512x512.png"), surface: "#24272a", filter: "" },
    { title: "Notebook · m", path: join(icons, "menu-bar-icon-m-128.png"), surface: "#f2f3f5", filter: "" },
    { title: "Windows / Linux", path: contrastPath, surface: "#f2f3f5", filter: "" },
  ].map((panel, index) => `<g>
      <rect x="${40 + index * 290}" y="110" width="250" height="270" rx="16" fill="${panel.surface}"/>
      <image x="${65 + index * 290}" y="140" width="200" height="200" href="${dataUrl(panel.path)}"/>
      <text x="${165 + index * 290}" y="410" text-anchor="middle">${panel.title}</text>
    </g>`).join("");
  const rows = [
    { y: 475, title: "Light surface", surface: "#edf0f2", filter: ' filter="url(#black)"' },
    { y: 785, title: "Dark surface", surface: "#24272a", filter: "" },
  ].map((row) => `<text x="40" y="${row.y - 20}">${row.title} · actual size above, enlarged raster below</text>` + [16, 18, 22, 32].map((size, index) => {
    const x = 40 + index * 290;
    const raster = dataUrl(join(templateDir, `${size}x${size}.png`));
    return `<g><rect x="${x}" y="${row.y}" width="250" height="240" rx="16" fill="${row.surface}"/>
      <image x="${x + (250 - size) / 2}" y="${row.y + 18}" width="${size}" height="${size}" href="${raster}"${row.filter}/>
      <image x="${x + 61}" y="${row.y + 75}" width="128" height="128" href="${raster}" image-rendering="pixelated"${row.filter}/>
      <text x="${x + 125}" y="${row.y + 265}" text-anchor="middle">${size} × ${size}</text></g>`;
  }).join("")).join("");
  const previewSource = join(temporaryRoot, "preview.svg");
  writeFileSync(previewSource, `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
    <defs><filter id="black"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/></filter></defs>
    <rect width="1200" height="1200" fill="#fff"/>
    <g font-family="Arial, sans-serif" fill="#25282b" font-size="18">
      <text x="40" y="55" font-size="30" font-weight="700">mclip · selected maple identity</text>
      <text x="40" y="85" fill="#687078">Generated assets · template surfaces are preview simulations</text>
      ${panels}${rows}
      <text x="40" y="1155" fill="#687078">Notebook source and derivatives unchanged · native platform acceptance remains separate</text>
    </g></svg>`);
  const output = join(temporaryRoot, "preview");
  generate(previewSource, output, [1200]);
  copyFileSync(join(output, "1200x1200.png"), previewPath);
}

const source = readFileSync(sourcePath);
if (source.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || source[25] !== 6) {
  throw new Error("The selected canonical source must be an RGBA PNG");
}
const side = source.readUInt32BE(16);
if (source.readUInt32BE(20) !== side) throw new Error("The selected icon must be square");
const temporaryRoot = mkdtempSync(join(tmpdir(), "mclip-maple-export-"));
try {
  const desktopDir = join(temporaryRoot, "desktop");
  generate(sourcePath, desktopDir);
  for (const file of readdirSync(desktopDir, { withFileTypes: true })) {
    if (!file.isFile() || !/\.(?:png|icns|ico)$/u.test(file.name)) continue;
    const input = join(desktopDir, file.name);
    const output = join(icons, file.name);
    // Tauri's ICNS frame order is unspecified; normalize the container, preserving every frame.
    if (file.name === "icon.icns") writeFileSync(output, canonicalizeIcns(readFileSync(input)));
    else copyFileSync(input, output);
  }
  const colorDir = join(temporaryRoot, "color");
  generate(sourcePath, colorDir, sizes);
  copyFileSync(join(colorDir, "64x64.png"), join(icons, "64x64.png"));
  copyFileSync(join(colorDir, "1024x1024.png"), join(projectRoot, "site/public/app-icon.png"));

  const templateSource = join(temporaryRoot, "template.svg");
  writeFileSync(templateSource, templateSvg(sourcePath, side));
  const templateDir = join(temporaryRoot, "template");
  generate(templateSource, templateDir, sizes);
  copyFileSync(join(templateDir, "512x512.png"), join(icons, "menu-bar-icon-light.png"));
  copyFileSync(join(templateDir, "128x128.png"), join(icons, "menu-bar-icon-light-128.png"));

  const contrastSource = join(temporaryRoot, "contrast.svg");
  writeFileSync(contrastSource, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <rect x="1" y="1" width="22" height="22" rx="6" fill="${MAPLE_CONTRAST_SURFACE}" stroke="${MAPLE_CONTRAST_BORDER}" stroke-width="1.5"/>
    <image x="2" y="2" width="20" height="20" href="${dataUrl(join(templateDir, "128x128.png"))}"/>
  </svg>`);
  const contrastDir = join(temporaryRoot, "contrast");
  generate(contrastSource, contrastDir, [32]);
  const contrastPath = join(icons, "menu-bar-icon-light-high-contrast.png");
  copyFileSync(join(contrastDir, "32x32.png"), contrastPath);
  createPreview(colorDir, templateDir, contrastPath, temporaryRoot);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
console.log("Generated maple desktop, template, contrast and website icons; notebook assets preserved.");
console.log(`Preview: ${previewPath}`);
