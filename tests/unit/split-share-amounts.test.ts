import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allocateSplitShareAmounts,
  canAcceptSplitShares,
  emptySharePlaceholder,
} from "../../src/lib/split-share-amounts";

describe("allocateSplitShareAmounts", () => {
  it("ceils equal integer shares across empty inputs", () => {
    const allocation = allocateSplitShareAmounts("100", ["", "", ""]);
    assert.equal(allocation.emptyCount, 3);
    assert.equal(allocation.isOverTotal, false);
    assert.deepEqual(allocation.resolved, ["34", "34", "34"]);
  });

  it("recalculates leftover after a custom amount as integers", () => {
    const allocation = allocateSplitShareAmounts("100", ["40", "", ""]);
    assert.equal(allocation.customSum.toString(), "40");
    assert.deepEqual(allocation.resolved, ["40", "30", "30"]);
  });

  it("splits an even remainder into integers", () => {
    const allocation = allocateSplitShareAmounts("10", ["", ""]);
    assert.deepEqual(allocation.resolved, ["5", "5"]);
  });

  it("allows typed integer shares that only exceed by ceil slack", () => {
    const allocation = allocateSplitShareAmounts("100", ["34", "34", "34"]);
    assert.equal(allocation.isOverTotal, false);
    assert.equal(canAcceptSplitShares("100", ["34", "34", "34"]), true);
  });

  it("marks over-total custom amounts beyond ceil slack", () => {
    const allocation = allocateSplitShareAmounts("100", ["80", "30", ""]);
    assert.equal(allocation.isOverTotal, true);
    assert.equal(canAcceptSplitShares("100", ["80", "30", ""]), false);
  });

  it("rejects a leftover empty share of zero", () => {
    assert.equal(canAcceptSplitShares("100", ["100", ""]), false);
    const allocation = allocateSplitShareAmounts("100", ["100", ""]);
    assert.equal(allocation.resolved[1], "");
  });
});

describe("emptySharePlaceholder", () => {
  it("returns the ceiled remaining share as an integer", () => {
    assert.equal(emptySharePlaceholder("90", ["30", ""]), "60");
    assert.equal(emptySharePlaceholder("100", ["", "", ""]), "34");
  });
});
