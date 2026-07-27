import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Decimal from "decimal.js";

import {
  attributeCashflowAmount,
  categoryAttributionType,
  categorySignedAmount,
  includeRowInCashflow,
  includeRowInDefaultCashflow,
  isSingleKindFilter,
} from "../../src/lib/cashflow-kinds";
import { TransactionKind, TransactionType } from "../../src/types/enums";

describe("cashflow kind helpers", () => {
  it("excludes only TRANSFER from default cashflow", () => {
    assert.equal(includeRowInDefaultCashflow(TransactionKind.Transfer), false);
    assert.equal(includeRowInDefaultCashflow(TransactionKind.Refund), true);
    assert.equal(includeRowInDefaultCashflow(TransactionKind.Loan), true);
  });

  it("includes TRANSFER when kind-scoped to transfer", () => {
    assert.equal(
      includeRowInCashflow(TransactionKind.Transfer, [TransactionKind.Transfer]),
      true,
    );
    assert.equal(
      includeRowInCashflow(TransactionKind.Transfer, [TransactionKind.Refund]),
      false,
    );
  });

  it("attributes refunds to spending and signs them negative by default", () => {
    const refund = {
      type: TransactionType.Earning,
      kind: TransactionKind.Refund,
    };
    assert.equal(categoryAttributionType(refund), TransactionType.Spending);
    assert.equal(
      categorySignedAmount(refund, new Decimal(10)).toString(),
      "-10",
    );
  });

  it("keeps refund magnitude positive when kind-scoped to refund", () => {
    const refund = { kind: TransactionKind.Refund };
    assert.equal(
      categorySignedAmount(refund, new Decimal(10), [
        TransactionKind.Refund,
      ]).toString(),
      "10",
    );
  });

  it("places refunds on spending series for timeline/heatmap", () => {
    const refund = {
      type: TransactionType.Earning,
      kind: TransactionKind.Refund,
    };
    const defaultAttr = attributeCashflowAmount(refund, new Decimal(25));
    assert.equal(defaultAttr.type, TransactionType.Spending);
    assert.equal(defaultAttr.amount.toString(), "-25");

    const scopedAttr = attributeCashflowAmount(refund, new Decimal(25), [
      TransactionKind.Refund,
    ]);
    assert.equal(scopedAttr.type, TransactionType.Spending);
    assert.equal(scopedAttr.amount.toString(), "25");
  });

  it("leaves ordinary earning and spending unchanged", () => {
    const earning = attributeCashflowAmount(
      { type: TransactionType.Earning, kind: TransactionKind.Default },
      new Decimal(40),
    );
    assert.equal(earning.type, TransactionType.Earning);
    assert.equal(earning.amount.toString(), "40");

    const spending = attributeCashflowAmount(
      { type: TransactionType.Spending, kind: TransactionKind.Default },
      new Decimal(15),
    );
    assert.equal(spending.type, TransactionType.Spending);
    assert.equal(spending.amount.toString(), "15");
  });

  it("detects single-kind filters", () => {
    assert.equal(isSingleKindFilter([TransactionKind.Refund]), true);
    assert.equal(isSingleKindFilter([]), false);
    assert.equal(isSingleKindFilter(undefined), false);
  });
});
