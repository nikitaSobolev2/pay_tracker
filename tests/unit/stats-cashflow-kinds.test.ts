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
  it("excludes TRANSFER and FORGIVE from default cashflow", () => {
    assert.equal(includeRowInDefaultCashflow(TransactionKind.Transfer), false);
    assert.equal(includeRowInDefaultCashflow(TransactionKind.Forgive), false);
    assert.equal(includeRowInDefaultCashflow(TransactionKind.Refund), true);
    assert.equal(includeRowInDefaultCashflow(TransactionKind.Loan), true);
    assert.equal(
      includeRowInDefaultCashflow(TransactionKind.Loan, "parent-id"),
      false,
    );
  });

  it("excludes split-share loans even under a Loan-only filter", () => {
    assert.equal(
      includeRowInCashflow(TransactionKind.Loan, [TransactionKind.Loan], "src"),
      false,
    );
  });

  it("includes FORGIVE when kind-scoped to forgive", () => {
    assert.equal(
      includeRowInCashflow(TransactionKind.Forgive, [TransactionKind.Forgive]),
      true,
    );
    assert.equal(
      includeRowInCashflow(TransactionKind.Forgive, [TransactionKind.Refund]),
      false,
    );
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

  it("attributes refunds as earnings with positive amounts", () => {
    const refund = {
      type: TransactionType.Earning,
      kind: TransactionKind.Refund,
    };
    assert.equal(categoryAttributionType(refund), TransactionType.Earning);
    assert.equal(categorySignedAmount(new Decimal(10)).toString(), "10");
  });

  it("places refunds on the earning series for timeline/heatmap", () => {
    const refund = {
      type: TransactionType.Earning,
      kind: TransactionKind.Refund,
    };
    const attributed = attributeCashflowAmount(refund, new Decimal(25));
    assert.equal(attributed.type, TransactionType.Earning);
    assert.equal(attributed.amount.toString(), "25");
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
