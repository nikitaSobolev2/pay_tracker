import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLoginTransferAuthUrl,
  isTransferExpired,
  isValidLoginCode,
  normalizeLoginCode,
  transferExpiresAt,
} from "../../src/lib/login-transfer";
import { isSessionActive } from "../../src/lib/session-activity";
import {
  generateNumericCode,
  generateTransferToken,
  hashSecret,
} from "../../src/server/services/login-transfer-crypto";

describe("login transfer crypto helpers", () => {
  it("hashes the same secret to the same digest", () => {
    assert.equal(hashSecret("123456"), hashSecret("123456"));
    assert.notEqual(hashSecret("123456"), hashSecret("654321"));
  });

  it("generates numeric codes of fixed length", () => {
    for (let index = 0; index < 20; index += 1) {
      const code = generateNumericCode();
      assert.match(code, /^\d{6}$/);
    }
  });

  it("generates unique opaque tokens", () => {
    const tokens = new Set(
      Array.from({ length: 20 }, () => generateTransferToken()),
    );
    assert.equal(tokens.size, 20);
  });
});

describe("login transfer pure helpers", () => {
  it("normalizes and validates login codes", () => {
    assert.equal(normalizeLoginCode("12-34-56"), "123456");
    assert.equal(isValidLoginCode("123456"), true);
    assert.equal(isValidLoginCode("12345"), false);
    assert.equal(isValidLoginCode("12345a"), false);
  });

  it("builds locale-aware auth URLs", () => {
    assert.equal(
      buildLoginTransferAuthUrl({
        baseUrl: "http://localhost:3000/",
        locale: "en",
        token: "abc/def",
      }),
      "http://localhost:3000/en/login/qr/abc%2Fdef",
    );
  });

  it("detects expired transfers", () => {
    const now = new Date("2026-07-25T12:00:00.000Z");
    const expiresAt = transferExpiresAt(now);
    assert.equal(isTransferExpired(expiresAt, now), false);
    assert.equal(
      isTransferExpired(expiresAt, new Date(expiresAt.getTime())),
      true,
    );
    assert.equal(
      isTransferExpired(expiresAt, new Date(expiresAt.getTime() + 1)),
      true,
    );
  });

  it("marks sessions active within threshold", () => {
    const now = new Date("2026-07-25T12:00:00.000Z");
    assert.equal(
      isSessionActive(new Date("2026-07-25T11:50:00.000Z"), now),
      true,
    );
    assert.equal(
      isSessionActive(new Date("2026-07-25T11:44:00.000Z"), now),
      false,
    );
  });
});
