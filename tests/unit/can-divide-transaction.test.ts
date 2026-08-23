import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canDivideTransaction } from "../../src/lib/can-divide-transaction";
import { TransactionKind } from "../../src/types/enums";

describe("canDivideTransaction", () => {
  it("allows default and refund cashflow rows", () => {
    assert.equal(
      canDivideTransaction({
        kind: TransactionKind.Default,
        sourceTransactionId: null,
        originalAmount: "10",
      }),
      true,
    );
    assert.equal(
      canDivideTransaction({
        kind: TransactionKind.Refund,
        sourceTransactionId: null,
        originalAmount: "10",
      }),
      true,
    );
  });

  it("hides loans, children, and zero amounts", () => {
    assert.equal(
      canDivideTransaction({
        kind: TransactionKind.Loan,
        sourceTransactionId: null,
        originalAmount: "10",
      }),
      false,
    );
    assert.equal(
      canDivideTransaction({
        kind: TransactionKind.Default,
        sourceTransactionId: "parent",
        originalAmount: "10",
      }),
      false,
    );
    assert.equal(
      canDivideTransaction({
        kind: TransactionKind.Default,
        sourceTransactionId: null,
        originalAmount: "0",
      }),
      false,
    );
  });
});
