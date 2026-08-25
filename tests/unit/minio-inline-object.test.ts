import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractEmbeddedObject,
  isStandaloneMedia,
  recoverMinioObject,
} from "../../src/lib/minio-inline-object";

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("payload"),
  Buffer.from("IEND"),
  Buffer.from([0, 0, 0, 0]),
]);

describe("extractEmbeddedObject", () => {
  it("pulls a PNG out of a MinIO xl.meta wrapper", () => {
    const wrapped = Buffer.concat([Buffer.from("xl-meta-hdr"), PNG, Buffer.from("tail")]);
    const extracted = extractEmbeddedObject(wrapped);
    assert.ok(extracted);
    assert.equal(extracted.compare(PNG), 0);
  });

  it("stops a JPEG at the first end marker", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x01, 0xff, 0xd9]);
    const wrapped = Buffer.concat([
      Buffer.from("hdr"),
      jpeg,
      Buffer.from([0xff, 0xd9, 0x00]),
    ]);
    const extracted = extractEmbeddedObject(wrapped);
    assert.ok(extracted);
    assert.equal(extracted.compare(jpeg), 0);
  });

  it("returns undefined when no known file signature exists", () => {
    assert.equal(extractEmbeddedObject(Buffer.from("not-a-file")), undefined);
  });
});

describe("recoverMinioObject", () => {
  it("strips a MinIO bitrot hash in front of a PNG", () => {
    const hashed = Buffer.concat([Buffer.alloc(32, 0xab), PNG]);
    assert.equal(isStandaloneMedia(hashed), false);
    assert.equal(recoverMinioObject(hashed).compare(PNG), 0);
  });

  it("leaves ordinary uploads unchanged", () => {
    const body = Buffer.from("cover-bytes");
    assert.equal(recoverMinioObject(body).toString(), "cover-bytes");
  });
});
