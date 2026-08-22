import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { reconcileTravelTransactionCache } from "@/lib/travel-transaction-cache";

describe("reconcileTravelTransactionCache", () => {
  it("keeps the row on the same travel", () => {
    assert.deepEqual(
      reconcileTravelTransactionCache({
        previousTravelId: "a",
        nextTravelId: "a",
      }),
      { removeFrom: null, upsertTo: "a" },
    );
  });

  it("unlinks by removing from the previous travel", () => {
    assert.deepEqual(
      reconcileTravelTransactionCache({
        previousTravelId: "a",
        nextTravelId: null,
      }),
      { removeFrom: "a", upsertTo: null },
    );
  });

  it("moves the row between travels", () => {
    assert.deepEqual(
      reconcileTravelTransactionCache({
        previousTravelId: "a",
        nextTravelId: "b",
      }),
      { removeFrom: "a", upsertTo: "b" },
    );
  });

  it("links a standalone row onto a travel", () => {
    assert.deepEqual(
      reconcileTravelTransactionCache({
        previousTravelId: null,
        nextTravelId: "b",
      }),
      { removeFrom: null, upsertTo: "b" },
    );
  });
});
