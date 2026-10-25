import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalizeIcns } from "../scripts/icon-container.mjs";

function frames(encoded) {
  const result = [];
  for (let offset = 8; offset < encoded.length;) {
    const length = encoded.readUInt32BE(offset + 4);
    result.push(encoded.subarray(offset, offset + length));
    offset += length;
  }
  return result;
}

test("ICNS exports are stable across frame ordering without changing image data", async () => {
  const original = await readFile("src-tauri/icons/icon.icns");
  const originalFrames = frames(original);
  const reversed = Buffer.concat([original.subarray(0, 8), ...[...originalFrames].reverse()]);
  const normalized = canonicalizeIcns(original);
  assert.deepEqual(normalized, canonicalizeIcns(reversed));
  assert.deepEqual(normalized, canonicalizeIcns(normalized));
  assert.deepEqual(frames(normalized).map((frame) => frame.toString("base64")).sort(),
    originalFrames.map((frame) => frame.toString("base64")).sort());
});

test("ICNS export rejects a malformed frame rather than writing a corrupt icon", () => {
  const invalid = Buffer.alloc(16);
  invalid.write("icns");
  invalid.writeUInt32BE(16, 4);
  invalid.write("ic07", 8);
  invalid.writeUInt32BE(0, 12);
  assert.throws(() => canonicalizeIcns(invalid), /Invalid ICNS frame length/);
});
