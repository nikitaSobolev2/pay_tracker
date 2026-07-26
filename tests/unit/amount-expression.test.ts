import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateAmountExpression } from "../../src/lib/amount-expression";

describe("evaluateAmountExpression", () => {
  it("respects multiplication before addition and subtraction", () => {
    assert.equal(evaluateAmountExpression("324 +111 - 122 * 3"), 69);
  });

  it("handles simple sum", () => {
    assert.equal(evaluateAmountExpression("10+5"), 15);
  });

  it("returns null for invalid input", () => {
    assert.equal(evaluateAmountExpression("abc"), null);
  });
});
