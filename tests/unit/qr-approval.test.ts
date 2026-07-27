import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildApprovalUrl, parseApprovalToken } from "../../src/lib/qr-approval";

describe("buildApprovalUrl", () => {
  it("builds a locale-aware, encoded approval URL", () => {
    assert.equal(
      buildApprovalUrl({
        baseUrl: "http://localhost:3000/",
        locale: "en",
        token: "abc/def",
      }),
      "http://localhost:3000/en/approve/abc%2Fdef",
    );
  });

  it("does not duplicate slashes when the base has none", () => {
    assert.equal(
      buildApprovalUrl({
        baseUrl: "https://app.example.com",
        locale: "ru",
        token: "token123",
      }),
      "https://app.example.com/ru/approve/token123",
    );
  });
});

describe("parseApprovalToken", () => {
  it("extracts the token from a full approval URL", () => {
    assert.equal(
      parseApprovalToken("http://localhost:3000/en/approve/token123"),
      "token123",
    );
  });

  it("decodes percent-encoded tokens and tolerates trailing slashes", () => {
    assert.equal(
      parseApprovalToken("https://app.example.com/ru/approve/abc%2Fdef/"),
      "abc/def",
    );
  });

  it("accepts a raw token payload", () => {
    assert.equal(parseApprovalToken("Tok_en-123"), "Tok_en-123");
  });

  it("rejects empty input", () => {
    assert.equal(parseApprovalToken("   "), null);
  });

  it("rejects URLs without an approve segment", () => {
    assert.equal(
      parseApprovalToken("http://localhost:3000/en/login/qr/token123"),
      null,
    );
  });

  it("rejects non-token free text", () => {
    assert.equal(parseApprovalToken("hello there"), null);
  });
});
