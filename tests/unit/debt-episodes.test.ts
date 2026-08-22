import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  debtBalanceDelta,
  detectCompletedDebtEpisodes,
  medianDays,
  medianSettleDaysFromEvents,
  type DebtEpisodeEvent,
} from "../../src/lib/debt-episodes";
import { TransactionKind, TransactionType } from "../../src/types/enums";

function at(iso: string): Date {
  return new Date(iso);
}

function event(
  iso: string,
  kind: TransactionKind,
  amountRub: number,
  type?: TransactionType,
): DebtEpisodeEvent {
  return {
    occurredAt: at(iso),
    kind,
    type:
      type ??
      (kind === TransactionKind.Debt
        ? TransactionType.Earning
        : TransactionType.Spending),
    amountRub,
  };
}

describe("debtBalanceDelta", () => {
  it("treats loan as positive regardless of type", () => {
    assert.equal(
      debtBalanceDelta(TransactionKind.Loan, TransactionType.Spending),
      1,
    );
    assert.equal(
      debtBalanceDelta(TransactionKind.Loan, TransactionType.Earning),
      1,
    );
  });

  it("treats debt as negative regardless of type", () => {
    assert.equal(
      debtBalanceDelta(TransactionKind.Debt, TransactionType.Spending),
      -1,
    );
    assert.equal(
      debtBalanceDelta(TransactionKind.Debt, TransactionType.Earning),
      -1,
    );
  });

  it("treats forgive like close: spending +, earning −", () => {
    assert.equal(
      debtBalanceDelta(TransactionKind.Forgive, TransactionType.Spending),
      1,
    );
    assert.equal(
      debtBalanceDelta(TransactionKind.Forgive, TransactionType.Earning),
      -1,
    );
  });

  it("returns zero for non-ledger kinds", () => {
    assert.equal(
      debtBalanceDelta(TransactionKind.Default, TransactionType.Spending),
      0,
    );
    assert.equal(
      debtBalanceDelta(TransactionKind.Refund, TransactionType.Earning),
      0,
    );
    assert.equal(
      debtBalanceDelta(TransactionKind.Transfer, TransactionType.Spending),
      0,
    );
  });
});

describe("detectCompletedDebtEpisodes", () => {
  it("measures lend then full repay as one episode", () => {
    const episodes = detectCompletedDebtEpisodes([
      event("2026-01-01T00:00:00.000Z", TransactionKind.Loan, 1000),
      event("2026-01-11T00:00:00.000Z", TransactionKind.Debt, 1000),
    ]);

    assert.equal(episodes.length, 1);
    assert.equal(episodes[0]!.durationDays, 10);
    assert.equal(episodes[0]!.tone, "owed");
  });

  it("settles an owed episode when forgive has the close sign", () => {
    const episodes = detectCompletedDebtEpisodes([
      event("2026-01-01T00:00:00.000Z", TransactionKind.Loan, 1000),
      event(
        "2026-01-11T00:00:00.000Z",
        TransactionKind.Forgive,
        1000,
        TransactionType.Earning,
      ),
    ]);

    assert.equal(episodes.length, 1);
    assert.equal(episodes[0]!.durationDays, 10);
    assert.equal(episodes[0]!.tone, "owed");
  });

  it("settles an owe episode when forgive has the close sign", () => {
    const episodes = detectCompletedDebtEpisodes([
      event("2026-01-01T00:00:00.000Z", TransactionKind.Debt, 500),
      event(
        "2026-01-06T00:00:00.000Z",
        TransactionKind.Forgive,
        500,
        TransactionType.Spending,
      ),
    ]);

    assert.equal(episodes.length, 1);
    assert.equal(episodes[0]!.durationDays, 5);
    assert.equal(episodes[0]!.tone, "owe");
  });

  it("ignores open episodes that never return to zero", () => {
    const episodes = detectCompletedDebtEpisodes([
      event("2026-01-01T00:00:00.000Z", TransactionKind.Debt, 500),
    ]);
    assert.deepEqual(episodes, []);
  });

  it("supports multiple cycles and partial repayments", () => {
    const episodes = detectCompletedDebtEpisodes([
      event("2026-01-01T00:00:00.000Z", TransactionKind.Loan, 1000),
      event("2026-01-06T00:00:00.000Z", TransactionKind.Debt, 400),
      event("2026-01-16T00:00:00.000Z", TransactionKind.Debt, 600),
      event("2026-02-01T00:00:00.000Z", TransactionKind.Debt, 200),
      event("2026-02-05T00:00:00.000Z", TransactionKind.Loan, 200),
    ]);

    assert.equal(episodes.length, 2);
    assert.equal(episodes[0]!.durationDays, 15);
    assert.equal(episodes[0]!.tone, "owed");
    assert.equal(episodes[1]!.durationDays, 4);
    assert.equal(episodes[1]!.tone, "owe");
  });

  it("treats a sign flip as settle plus reopen", () => {
    const episodes = detectCompletedDebtEpisodes([
      event("2026-01-01T00:00:00.000Z", TransactionKind.Loan, 100),
      event("2026-01-04T00:00:00.000Z", TransactionKind.Debt, 250),
      event("2026-01-10T00:00:00.000Z", TransactionKind.Loan, 150),
    ]);

    assert.equal(episodes.length, 2);
    assert.equal(episodes[0]!.tone, "owed");
    assert.equal(episodes[0]!.durationDays, 3);
    assert.equal(episodes[1]!.tone, "owe");
    assert.equal(episodes[1]!.durationDays, 6);
  });
});

describe("medianSettleDaysFromEvents", () => {
  it("returns median across completed episode durations", () => {
    const median = medianSettleDaysFromEvents([
      event("2026-01-01T00:00:00.000Z", TransactionKind.Loan, 10),
      event("2026-01-03T00:00:00.000Z", TransactionKind.Debt, 10),
      event("2026-02-01T00:00:00.000Z", TransactionKind.Loan, 10),
      event("2026-02-11T00:00:00.000Z", TransactionKind.Debt, 10),
      event("2026-03-01T00:00:00.000Z", TransactionKind.Loan, 10),
      event("2026-03-05T00:00:00.000Z", TransactionKind.Debt, 10),
    ]);

    assert.equal(median, 4);
  });

  it("can filter by episode tone", () => {
    const events = [
      event("2026-01-01T00:00:00.000Z", TransactionKind.Loan, 10),
      event("2026-01-11T00:00:00.000Z", TransactionKind.Debt, 10),
      event("2026-02-01T00:00:00.000Z", TransactionKind.Debt, 10),
      event("2026-02-03T00:00:00.000Z", TransactionKind.Loan, 10),
    ];

    assert.equal(medianSettleDaysFromEvents(events, "owed"), 10);
    assert.equal(medianSettleDaysFromEvents(events, "owe"), 2);
  });
});

describe("medianDays", () => {
  it("handles empty and even-length lists", () => {
    assert.equal(medianDays([]), null);
    assert.equal(medianDays([1, 3, 5]), 3);
    assert.equal(medianDays([2, 4]), 3);
  });
});
