import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { openEpisodeOrientedAmounts } from "../../src/lib/debt-amount-history";

describe("openEpisodeOrientedAmounts", () => {
  it("keeps current-episode parts after a settle", () => {
    const history = openEpisodeOrientedAmounts(
      [
        { signedAmount: "200" },
        { signedAmount: "-200" },
        { signedAmount: "100" },
        { signedAmount: "500" },
      ],
      1,
    );
    assert.deepEqual(history, ["100", "500"]);
  });

  it("orients parts so plus increases the shown I-owe debt", () => {
    const history = openEpisodeOrientedAmounts(
      [{ signedAmount: "-100" }, { signedAmount: "-500" }],
      -1,
    );
    assert.deepEqual(history, ["100", "500"]);
  });
});
