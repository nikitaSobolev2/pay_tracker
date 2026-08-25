import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractEmbeddedObject } from "../../src/lib/minio-inline-object";

describe("extractEmbeddedObject", () => {
  it("pulls a PNG out of a MinIO xl.meta wrapper", () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("payload"),
      Buffer.from("IEND"),
      Buffer.from([0, 0, 0, 0]),
    ]);
    const wrapped = Buffer.concat([Buffer.from("xl-meta-hdr"), png, Buffer.from("tail")]);
    const extracted = extractEmbeddedObject(wrapped);
    assert.ok(extracted);
    assert.equal(extracted.compare(png), 0);
  });

  it("returns undefined when no known file signature exists", () => {
    assert.equal(extractEmbeddedObject(Buffer.from("not-a-file")), undefined);
  });
});
