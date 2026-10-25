export function canonicalizeIcns(encoded) {
  if (encoded.toString("ascii", 0, 4) !== "icns" || encoded.readUInt32BE(4) !== encoded.length) {
    throw new Error("Invalid ICNS header");
  }
  const frames = [];
  for (let offset = 8; offset < encoded.length;) {
    if (offset + 8 > encoded.length) throw new Error("Truncated ICNS frame");
    const length = encoded.readUInt32BE(offset + 4);
    if (length < 8 || offset + length > encoded.length) throw new Error("Invalid ICNS frame length");
    frames.push(encoded.subarray(offset, offset + length));
    offset += length;
  }
  return Buffer.concat([encoded.subarray(0, 8), ...frames.sort(Buffer.compare)]);
}
