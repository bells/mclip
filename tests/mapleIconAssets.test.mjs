import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { decodePng } from "./helpers/png.mjs";

function assertRusset(image) {
  let foreground = 0;
  let russet = 0;
  let transparent = 0;
  for (let offset = 0; offset < image.pixels.length; offset += 4) {
    const [r, g, b, a] = image.pixels.subarray(offset, offset + 4);
    if (a === 0) transparent += 1;
    if (a < 240) continue;
    foreground += 1;
    if (r > g + 12 && g > b && r - b < 125) russet += 1;
  }
  assert.ok(foreground > image.width * image.height * 0.15, "leaf must remain visible");
  assert.ok(transparent > image.width * image.height * 0.15, "canvas must remain transparent");
  assert.ok(russet / foreground > 0.95, "current brand must use muted russet, not the old green leaf");
}

test("desktop and current website PNGs use the selected russet identity", async () => {
  for (const [path, size] of [
    ["src-tauri/icons/32x32.png", 32],
    ["src-tauri/icons/64x64.png", 64],
    ["src-tauri/icons/128x128.png", 128],
    ["src-tauri/icons/128x128@2x.png", 256],
    ["site/public/app-icon.png", 1024],
  ]) {
    const image = decodePng(await readFile(path));
    assert.equal(image.width, size);
    assert.equal(image.height, size);
    assertRusset(image);
  }
});

test("native template preserves the color maple silhouette and an open m", async () => {
  const color = decodePng(await readFile("src-tauri/icons/128x128.png"));
  const template = decodePng(await readFile("src-tauri/icons/menu-bar-icon-light-128.png"));
  assert.equal(template.width, 128);
  assert.equal(template.height, 128);
  let intersection = 0;
  let union = 0;
  let cutout = 0;
  for (let y = 0; y < 128; y += 1) {
    for (let x = 0; x < 128; x += 1) {
      const offset = (y * 128 + x) * 4;
      const colorVisible = color.pixels[offset + 3] >= 128;
      const templateVisible = template.pixels[offset + 3] >= 128;
      if (colorVisible && templateVisible) intersection += 1;
      if (colorVisible || templateVisible) union += 1;
      if (template.pixels[offset + 3] >= 240) {
        assert.ok(template.pixels[offset] >= 254);
        assert.ok(template.pixels[offset + 1] >= 254);
        assert.ok(template.pixels[offset + 2] >= 254);
      }
      if (x > 38 && x < 92 && y > 64 && y < 92 && template.pixels[offset + 3] < 32) cutout += 1;
    }
  }
  assert.ok(intersection / union > 0.98, "color and template must use the same maple silhouette");
  assert.ok(cutout > 120, "the central m must remain a transparent cutout");
});

test("Windows ICO and macOS ICNS contain the new color identity", async () => {
  const ico = await readFile("src-tauri/icons/icon.ico");
  const entries = Array.from({ length: ico.readUInt16LE(4) }, (_, index) => {
    const entry = 6 + index * 16;
    return { size: ico[entry] || 256, offset: ico.readUInt32LE(entry + 12), length: ico.readUInt32LE(entry + 8) };
  }).sort((a, b) => b.size - a.size);
  assertRusset(decodePng(ico.subarray(entries[0].offset, entries[0].offset + entries[0].length)));

  const icns = await readFile("src-tauri/icons/icon.icns");
  assert.equal(icns.toString("ascii", 0, 4), "icns");
  const pngs = [];
  for (let offset = 8; offset < icns.length;) {
    const length = icns.readUInt32BE(offset + 4);
    const data = icns.subarray(offset + 8, offset + length);
    if (data.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") pngs.push(data);
    offset += length;
  }
  assert.ok(pngs.length > 0, "ICNS must include raster icon representations");
  for (const png of pngs) assertRusset(decodePng(png));
});
