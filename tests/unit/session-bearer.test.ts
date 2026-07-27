import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseBearerToken,
  sessionTokenCandidates,
} from "../../src/lib/session-token";

describe("parseBearerToken", () => {
  it("returns null for missing or non-bearer headers", () => {
    assert.equal(parseBearerToken(null), null);
    assert.equal(parseBearerToken(""), null);
    assert.equal(parseBearerToken("Basic abc"), null);
  });

  it("extracts the credential after Bearer", () => {
    assert.equal(parseBearerToken("Bearer abc.def"), "abc.def");
    assert.equal(parseBearerToken("bearer raw-token"), "raw-token");
  });
});

describe("sessionTokenCandidates", () => {
  it("includes signed and raw forms", () => {
    assert.deepEqual(sessionTokenCandidates("raw.signature"), [
      "raw.signature",
      "raw",
    ]);
  });

  it("decodes URI-encoded tokens", () => {
    const encoded = encodeURIComponent("raw.signature");
    const candidates = sessionTokenCandidates(encoded);
    assert.ok(candidates.includes("raw.signature"));
    assert.ok(candidates.includes("raw"));
  });
});
