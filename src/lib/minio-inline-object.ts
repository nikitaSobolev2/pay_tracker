const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const PNG_IEND = Buffer.from("IEND");
const JPEG_SOI = Buffer.from([0xff, 0xd8, 0xff]);
const JPEG_EOI = Buffer.from([0xff, 0xd9]);
const GIF_SIGNATURE = Buffer.from("GIF8");
const PDF_SIGNATURE = Buffer.from("%PDF");
const PDF_EOF = Buffer.from("%%EOF");
const RIFF = Buffer.from("RIFF");
const WEBP = Buffer.from("WEBP");
const BITROT_HASH_BYTES = 32;

/**
 * MinIO XL inlines small objects in xl.meta and prefixes part.1 with a
 * HighwayHash. Recover the original file by locating its magic bytes.
 */
export function extractEmbeddedObject(data: Buffer): Buffer | undefined {
  return (
    extractPng(data) ??
    extractJpeg(data) ??
    extractWebp(data) ??
    extractGif(data) ??
    extractPdf(data)
  );
}

/** True when `data` already starts as a file we can hand to a browser. */
export function isStandaloneMedia(data: Buffer): boolean {
  if (startsWith(data, PNG_SIGNATURE) || startsWith(data, JPEG_SOI)) {
    return true;
  }
  if (startsWith(data, GIF_SIGNATURE) || startsWith(data, PDF_SIGNATURE)) {
    return true;
  }
  return (
    data.length >= 12 &&
    startsWith(data, RIFF) &&
    data.subarray(8, 12).equals(WEBP)
  );
}

function startsWith(data: Buffer, signature: Buffer): boolean {
  return (
    data.length >= signature.length &&
    data.subarray(0, signature.length).equals(signature)
  );
}

/** Prefer a real file; otherwise peel MinIO wrappers. */
export function recoverMinioObject(data: Buffer): Buffer {
  if (isStandaloneMedia(data)) {
    return data;
  }
  const embedded = extractEmbeddedObject(data);
  if (embedded) {
    return embedded;
  }
  if (data.length > BITROT_HASH_BYTES) {
    const withoutHash = data.subarray(BITROT_HASH_BYTES);
    if (isStandaloneMedia(withoutHash)) {
      return withoutHash;
    }
  }
  return data;
}

function extractPng(data: Buffer): Buffer | undefined {
  const start = data.indexOf(PNG_SIGNATURE);
  if (start < 0) {
    return undefined;
  }
  const marker = data.indexOf(PNG_IEND, start);
  if (marker < 0) {
    return undefined;
  }
  return data.subarray(start, marker + 8);
}

function extractJpeg(data: Buffer): Buffer | undefined {
  const start = data.indexOf(JPEG_SOI);
  if (start < 0) {
    return undefined;
  }
  const end = data.indexOf(JPEG_EOI, start + JPEG_SOI.length);
  if (end < 0) {
    return undefined;
  }
  return data.subarray(start, end + JPEG_EOI.length);
}

function extractWebp(data: Buffer): Buffer | undefined {
  const start = data.indexOf(RIFF);
  if (start < 0) {
    return undefined;
  }
  if (data.length < start + 12) {
    return undefined;
  }
  if (!data.subarray(start + 8, start + 12).equals(WEBP)) {
    return undefined;
  }
  const size = data.readUInt32LE(start + 4);
  const end = start + 8 + size;
  if (end > data.length) {
    return undefined;
  }
  return data.subarray(start, end);
}

function extractGif(data: Buffer): Buffer | undefined {
  const start = data.indexOf(GIF_SIGNATURE);
  if (start < 0) {
    return undefined;
  }
  const end = data.indexOf(0x3b, start);
  if (end < 0) {
    return undefined;
  }
  return data.subarray(start, end + 1);
}

function extractPdf(data: Buffer): Buffer | undefined {
  const start = data.indexOf(PDF_SIGNATURE);
  if (start < 0) {
    return undefined;
  }
  const marker = data.lastIndexOf(PDF_EOF);
  if (marker < start) {
    return undefined;
  }
  return data.subarray(start, marker + PDF_EOF.length);
}
