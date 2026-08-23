import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { uniqueRecentAmounts } from "../../src/lib/unique-recent-amounts";

describe("uniqueRecentAmounts", () => {
  it("drops duplicates and keeps first-seen order", () => {
    assert.deepEqual(uniqueRecentAmounts(["100.0000", "50", "100", "25.00"]), [
      "100",
      "50",
      "25",
    ]);
  });

  it("caps the list", () => {
    assert.equal(uniqueRecentAmounts(["1", "2", "3"], 2).length, 2);
  });
});
