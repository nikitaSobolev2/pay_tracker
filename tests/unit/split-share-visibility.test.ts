import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldIncludeSplitSharesInList } from "../../src/lib/split-share-visibility";
import { TransactionKind } from "../../src/types/enums";

describe("shouldIncludeSplitSharesInList", () => {
  it("hides sourced rows by default", () => {
    assert.equal(shouldIncludeSplitSharesInList({}), false);
  });

  it("includes them for debt-ledger kind filters", () => {
    assert.equal(
      shouldIncludeSplitSharesInList({ kinds: [TransactionKind.Loan] }),
      true,
    );
  });

  it("includes them when filtering by person", () => {
    assert.equal(
      shouldIncludeSplitSharesInList({ counterpartyIds: ["abc"] }),
      true,
    );
  });
});
