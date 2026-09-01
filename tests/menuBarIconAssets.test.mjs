import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = "89504e470d0a1a0a";

function paethPredictor(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function decodeAlphaContract(png, expectedSize) {
  assert.equal(png.subarray(0, 8).toString("hex"), PNG_SIGNATURE);

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    } else if (type === "IDAT") {
      idatChunks.push(data);
    }
    offset += length + 12;
  }

  assert.equal(width, expectedSize);
  assert.equal(height, expectedSize);
  assert.equal(bitDepth, 8);
  assert.ok(colorType === 4 || colorType === 6, "PNG must contain an alpha channel");

  const bytesPerPixel = colorType === 6 ? 4 : 2;
  const rowLength = width * bytesPerPixel;
  const filtered = inflateSync(Buffer.concat(idatChunks));
  const previous = Buffer.alloc(rowLength);
  let sourceOffset = 0;
  let minimumAlpha = 255;
  let maximumAlpha = 0;

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filter = filtered[sourceOffset];
    sourceOffset += 1;
    const current = Buffer.alloc(rowLength);
    for (let index = 0; index < rowLength; index += 1) {
      const source = filtered[sourceOffset + index];
      const left = index >= bytesPerPixel ? current[index - bytesPerPixel] : 0;
      const above = previous[index];
      const upperLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? above
              : filter === 3
                ? Math.floor((left + above) / 2)
                : paethPredictor(left, above, upperLeft);
      assert.ok(filter >= 0 && filter <= 4, `unsupported PNG filter ${filter}`);
      current[index] = (source + predictor) & 0xff;
    }
    sourceOffset += rowLength;
    current.copy(previous);

    for (let index = bytesPerPixel - 1; index < rowLength; index += bytesPerPixel) {
      minimumAlpha = Math.min(minimumAlpha, current[index]);
      maximumAlpha = Math.max(maximumAlpha, current[index]);
    }
  }

  assert.equal(minimumAlpha, 0, "PNG canvas must contain transparent pixels");
  assert.equal(maximumAlpha, 255, "PNG must contain opaque foreground pixels");
}

test("notebook m icon keeps one explicit monochrome vector source", async () => {
  const source = await readFile("src-tauri/icons/menu-bar-icon-m.svg", "utf8");

  assert.match(source, /viewBox="0 0 24 24"/);
  assert.match(source, /data-icon-part="notebook"/);
  assert.match(source, /data-icon-part="binding"/);
  assert.match(source, /data-icon-part="letter-m"/);
  assert.doesNotMatch(source, /<(?:text|filter|linearGradient|radialGradient)\b/);
  assert.doesNotMatch(source, /font-family=/);
});

test("notebook m derivatives retain required dimensions and transparency", async () => {
  const [runtimePng, preferencesPng] = await Promise.all([
    readFile("src-tauri/icons/menu-bar-icon-m.png"),
    readFile("src-tauri/icons/menu-bar-icon-m-128.png"),
  ]);

  decodeAlphaContract(runtimePng, 512);
  decodeAlphaContract(preferencesPng, 128);
});

test("notebook m stays wired to Preferences and native template rendering", async () => {
  const [preferences, rust, types, generator, zhCn, en, ja] = await Promise.all([
    readFile("src/components/PreferencesWindow.tsx", "utf8"),
    readFile("src-tauri/src/lib.rs", "utf8"),
    readFile("src/types.ts", "utf8"),
    readFile("scripts/generate-menu-bar-m-icon.mjs", "utf8"),
    readFile("src/i18n/zhCn.ts", "utf8"),
    readFile("src/i18n/en.ts", "utf8"),
    readFile("src/i18n/ja.ts", "utf8"),
  ]);

  assert.match(preferences, /menu-bar-icon-m-128\.png/);
  assert.match(rust, /include_bytes!\("\.\.\/icons\/menu-bar-icon-m\.png"\)/);
  assert.match(
    rust,
    /matches!\(style, MenuBarIconStyle::Light \| MenuBarIconStyle::M\)/,
  );
  assert.match(types, /"appIcon" \| "light" \| "m"/);
  assert.match(generator, /requestedSizes = \[16, 18, 22, 128, 512\]/);
  assert.match(generator, /copyFileSync\(runtimeGenerated, runtimePath\)/);
  assert.match(generator, /copyFileSync\(preferencesGenerated, preferencesPath\)/);
  assert.match(zhCn, /带小写 m 的记事本模板图标/);
  assert.match(en, /notebook with a lowercase m/);
  assert.match(ja, /小文字の m を配したノート型/);
});
