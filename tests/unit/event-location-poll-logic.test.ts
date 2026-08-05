import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolvePollWinner,
  tallyVotesByOption,
  votePercent,
} from "../../src/server/services/event-location-poll-logic";
import {
  extractImageFromHtml,
  resolveAbsoluteUrl,
} from "../../src/server/services/link-preview";

describe("resolvePollWinner", () => {
  it("returns empty when there are no options", () => {
    assert.deepEqual(resolvePollWinner([], []), { kind: "empty" });
  });

  it("picks the unique leader", () => {
    const result = resolvePollWinner(
      ["a", "b", "c"],
      [{ optionId: "a" }, { optionId: "a" }, { optionId: "b" }],
    );
    assert.deepEqual(result, { kind: "unique", optionId: "a" });
  });

  it("returns a tie when leaders share the max count", () => {
    const result = resolvePollWinner(
      ["a", "b", "c"],
      [{ optionId: "a" }, { optionId: "b" }],
    );
    assert.equal(result.kind, "tie");
    if (result.kind === "tie") {
      assert.deepEqual([...result.optionIds].sort(), ["a", "b"]);
    }
  });

  it("treats zero votes as a tie across all options", () => {
    const result = resolvePollWinner(["a", "b"], []);
    assert.equal(result.kind, "tie");
    if (result.kind === "tie") {
      assert.deepEqual([...result.optionIds].sort(), ["a", "b"]);
    }
  });
});

describe("tallyVotesByOption", () => {
  it("counts votes per option", () => {
    const counts = tallyVotesByOption([
      { optionId: "a" },
      { optionId: "a" },
      { optionId: "b" },
    ]);
    assert.equal(counts.get("a"), 2);
    assert.equal(counts.get("b"), 1);
  });
});

describe("votePercent", () => {
  it("returns zero when there are no votes", () => {
    assert.equal(votePercent(3, 0), 0);
  });

  it("rounds to two decimals", () => {
    assert.equal(votePercent(1, 3), 33.33);
  });
});

describe("extractImageFromHtml", () => {
  it("reads og:image and resolves relative URLs", () => {
    const html = `<html><head><meta property="og:image" content="/img/cover.jpg"></head></html>`;
    assert.equal(
      extractImageFromHtml(html, "https://example.com/page"),
      "https://example.com/img/cover.jpg",
    );
  });

  it("prefers og:image over twitter:image", () => {
    const html = `
      <meta name="twitter:image" content="https://cdn.example/tw.jpg">
      <meta property="og:image" content="https://cdn.example/og.jpg">
    `;
    assert.equal(
      extractImageFromHtml(html, "https://example.com"),
      "https://cdn.example/og.jpg",
    );
  });

  it("returns null when nothing matches", () => {
    assert.equal(extractImageFromHtml("<html></html>", "https://x.com"), null);
  });
});

describe("resolveAbsoluteUrl", () => {
  it("rejects non-http schemes", () => {
    assert.equal(resolveAbsoluteUrl("javascript:alert(1)", "https://x.com"), null);
  });
});
