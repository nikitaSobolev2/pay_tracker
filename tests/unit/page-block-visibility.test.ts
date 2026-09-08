import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  eventPageBlockScope,
  isPageBlockHidden,
  parsePageBlocksState,
  travelPageBlockScope,
  withPageBlockHidden,
} from "@/lib/page-block-visibility";

describe("parsePageBlocksState", () => {
  it("returns empty object for missing or invalid input", () => {
    assert.deepEqual(parsePageBlocksState(null), {});
    assert.deepEqual(parsePageBlocksState("not-json"), {});
    assert.deepEqual(parsePageBlocksState("[]"), {});
  });

  it("parses a nested flag map", () => {
    const state = parsePageBlocksState(
      JSON.stringify({ "travel:t1": { tickets: true } }),
    );
    assert.equal(isPageBlockHidden(state, "travel:t1", "tickets"), true);
    assert.equal(isPageBlockHidden(state, "travel:t1", "heatmap"), false);
  });
});

describe("withPageBlockHidden", () => {
  it("hides a block and drops empty scopes on show", () => {
    const hidden = withPageBlockHidden({}, "travel:t1", "tickets", true);
    assert.deepEqual(hidden, { "travel:t1": { tickets: true } });
    const shown = withPageBlockHidden(hidden, "travel:t1", "tickets", false);
    assert.deepEqual(shown, {});
  });
});

describe("page block scopes", () => {
  it("keeps travel and event ids on separate keys", () => {
    assert.equal(travelPageBlockScope("t1"), "travel:t1");
    assert.equal(eventPageBlockScope("e1"), "event:e1");
  });
});
