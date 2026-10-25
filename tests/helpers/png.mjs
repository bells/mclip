import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";

function paeth(left, above, diagonal) {
  const prediction = left + above - diagonal;
  const distances = [left, above, diagonal].map((value) => Math.abs(prediction - value));
  return [left, above, diagonal][distances.indexOf(Math.min(...distances))];
}

export function decodePng(png) {
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.equal(png[24], 8);
  const colorType = png[25];
  assert.ok(colorType === 6 || colorType === 4, "expected an alpha PNG");
  const bytesPerPixel = colorType === 6 ? 4 : 2;
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === "IDAT") {
      chunks.push(png.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const filtered = inflateSync(Buffer.concat(chunks));
  const rowLength = width * bytesPerPixel;
  const pixels = Buffer.alloc(width * height * 4);
  let previous = Buffer.alloc(rowLength);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = filtered[sourceOffset++];
    assert.ok(filter <= 4, "unsupported PNG filter");
    const row = Buffer.alloc(rowLength);
    for (let index = 0; index < rowLength; index += 1) {
      const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
      const above = previous[index];
      const diagonal = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above
        : filter === 3 ? Math.floor((left + above) / 2) : paeth(left, above, diagonal);
      row[index] = (filtered[sourceOffset + index] + predictor) & 255;
    }
    sourceOffset += rowLength;
    for (let x = 0; x < width; x += 1) {
      const input = x * bytesPerPixel;
      const output = (y * width + x) * 4;
      pixels[output] = row[input];
      pixels[output + 1] = colorType === 6 ? row[input + 1] : row[input];
      pixels[output + 2] = colorType === 6 ? row[input + 2] : row[input];
      pixels[output + 3] = row[input + bytesPerPixel - 1];
    }
    previous = row;
  }
  return { width, height, pixels };
}
