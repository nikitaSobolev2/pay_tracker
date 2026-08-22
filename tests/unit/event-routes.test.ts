import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  eventAppPath,
  eventPublicPath,
  rewritePublicEventPathToApp,
} from "../../src/lib/event-routes";

describe("eventAppPath", () => {
  it("builds the in-app event detail path", () => {
    assert.equal(eventAppPath("abc"), "/events/abc");
  });
});

describe("eventPublicPath", () => {
  it("builds the public guest event path", () => {
    assert.equal(eventPublicPath("abc"), "/event/abc");
  });
});

describe("rewritePublicEventPathToApp", () => {
  it("rewrites a locale-prefixed public event URL", () => {
    assert.equal(
      rewritePublicEventPathToApp("/en/event/abc", "/event/abc"),
      "/en/events/abc",
    );
  });

  it("rewrites a public event URL with no locale prefix", () => {
    assert.equal(
      rewritePublicEventPathToApp("/event/abc", "/event/abc"),
      "/events/abc",
    );
  });

  it("does not rewrite the events list or in-app detail", () => {
    assert.equal(rewritePublicEventPathToApp("/en/events", "/events"), null);
    assert.equal(
      rewritePublicEventPathToApp("/en/events/abc", "/events/abc"),
      null,
    );
  });

  it("does not rewrite unrelated paths", () => {
    assert.equal(rewritePublicEventPathToApp("/en/share/x", "/share/x"), null);
    assert.equal(rewritePublicEventPathToApp("/en/event", "/event"), null);
  });
});
