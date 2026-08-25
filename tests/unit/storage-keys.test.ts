import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  contentTypeForFileName,
  isPublicObjectKey,
  isSafeObjectKey,
  isTravelTicketKey,
  objectKeyFromSegments,
  stripBucketPrefix,
} from "../../src/lib/storage-keys";

describe("isSafeObjectKey", () => {
  it("rejects parent-directory segments", () => {
    assert.equal(isSafeObjectKey("events/covers/../secret.png"), false);
  });

  it("accepts a stored cover key", () => {
    assert.equal(
      isSafeObjectKey("events/covers/11111111-1111-1111-1111-111111111111.png"),
      true,
    );
  });
});

describe("isPublicObjectKey", () => {
  const cover = "events/covers/11111111-1111-1111-1111-111111111111.png";
  const ticket = "travels/tickets/11111111-1111-1111-1111-111111111111.pdf";

  it("allows event covers and travel covers", () => {
    assert.equal(isPublicObjectKey(cover), true);
    assert.equal(
      isPublicObjectKey(
        "travels/covers/11111111-1111-1111-1111-111111111111.jpg",
      ),
      true,
    );
  });

  it("does not treat tickets as public", () => {
    assert.equal(isPublicObjectKey(ticket), false);
    assert.equal(isTravelTicketKey(ticket), true);
  });
});

describe("objectKeyFromSegments", () => {
  it("strips a leading bucket folder from nginx-proxied paths", () => {
    assert.equal(
      objectKeyFromSegments([
        "paytracker",
        "events",
        "covers",
        "11111111-1111-1111-1111-111111111111.png",
      ]),
      "events/covers/11111111-1111-1111-1111-111111111111.png",
    );
  });

  it("leaves keys without a bucket prefix unchanged", () => {
    assert.equal(
      stripBucketPrefix("events/covers/a.png"),
      "events/covers/a.png",
    );
  });
});

describe("contentTypeForFileName", () => {
  it("maps image and pdf extensions", () => {
    assert.equal(contentTypeForFileName("cover.webp"), "image/webp");
    assert.equal(contentTypeForFileName("pass.pdf"), "application/pdf");
  });
});
