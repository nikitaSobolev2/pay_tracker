import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectCompletedDebtEpisodes,
  medianDays,
  medianSettleDaysFromEvents,
} from "../../src/lib/debt-episodes";
import { TransactionKind } from "../../src/types/enums";

function at(iso: string): Date {
  return new Date(iso);
}

describe("detectCompletedDebtEpisodes", () => {
  it("measures lend then full repay as one episode", () => {
    const episodes = detectCompletedDebtEpisodes([
      {
        occurredAt: at("2026-01-01T00:00:00.000Z"),
        kind: TransactionKind.Loan,
        amountRub: 1000,
      },
      {
        occurredAt: at("2026-01-11T00:00:00.000Z"),
        kind: TransactionKind.Debt,
        amountRub: 1000,
      },
    ]);

    assert.equal(episodes.length, 1);
    assert.equal(episodes[0]!.durationDays, 10);
    assert.equal(episodes[0]!.tone, "owed");
  });

  it("ignores open episodes that never return to zero", () => {
    const episodes = detectCompletedDebtEpisodes([
      {
        occurredAt: at("2026-01-01T00:00:00.000Z"),
        kind: TransactionKind.Debt,
        amountRub: 500,
      },
    ]);
    assert.deepEqual(episodes, []);
  });

  it("supports multiple cycles and partial repayments", () => {
    const episodes = detectCompletedDebtEpisodes([
      {
        occurredAt: at("2026-01-01T00:00:00.000Z"),
        kind: TransactionKind.Loan,
        amountRub: 1000,
      },
      {
        occurredAt: at("2026-01-06T00:00:00.000Z"),
        kind: TransactionKind.Debt,
        amountRub: 400,
      },
      {
        occurredAt: at("2026-01-16T00:00:00.000Z"),
        kind: TransactionKind.Debt,
        amountRub: 600,
      },
      {
        occurredAt: at("2026-02-01T00:00:00.000Z"),
        kind: TransactionKind.Debt,
        amountRub: 200,
      },
      {
        occurredAt: at("2026-02-05T00:00:00.000Z"),
        kind: TransactionKind.Loan,
        amountRub: 200,
      },
    ]);

    assert.equal(episodes.length, 2);
    assert.equal(episodes[0]!.durationDays, 15);
    assert.equal(episodes[0]!.tone, "owed");
    assert.equal(episodes[1]!.durationDays, 4);
    assert.equal(episodes[1]!.tone, "owe");
  });

  it("treats a sign flip as settle plus reopen", () => {
    const episodes = detectCompletedDebtEpisodes([
      {
        occurredAt: at("2026-01-01T00:00:00.000Z"),
        kind: TransactionKind.Loan,
        amountRub: 100,
      },
      {
        occurredAt: at("2026-01-04T00:00:00.000Z"),
        kind: TransactionKind.Debt,
        amountRub: 250,
      },
      {
        occurredAt: at("2026-01-10T00:00:00.000Z"),
        kind: TransactionKind.Loan,
        amountRub: 150,
      },
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
      {
        occurredAt: at("2026-01-01T00:00:00.000Z"),
        kind: TransactionKind.Loan,
        amountRub: 10,
      },
      {
        occurredAt: at("2026-01-03T00:00:00.000Z"),
        kind: TransactionKind.Debt,
        amountRub: 10,
      },
      {
        occurredAt: at("2026-02-01T00:00:00.000Z"),
        kind: TransactionKind.Loan,
        amountRub: 10,
      },
      {
        occurredAt: at("2026-02-11T00:00:00.000Z"),
        kind: TransactionKind.Debt,
        amountRub: 10,
      },
      {
        occurredAt: at("2026-03-01T00:00:00.000Z"),
        kind: TransactionKind.Loan,
        amountRub: 10,
      },
      {
        occurredAt: at("2026-03-05T00:00:00.000Z"),
        kind: TransactionKind.Debt,
        amountRub: 10,
      },
    ]);

    assert.equal(median, 4);
  });

  it("can filter by episode tone", () => {
    const events = [
      {
        occurredAt: at("2026-01-01T00:00:00.000Z"),
        kind: TransactionKind.Loan,
        amountRub: 10,
      },
      {
        occurredAt: at("2026-01-11T00:00:00.000Z"),
        kind: TransactionKind.Debt,
        amountRub: 10,
      },
      {
        occurredAt: at("2026-02-01T00:00:00.000Z"),
        kind: TransactionKind.Debt,
        amountRub: 10,
      },
      {
        occurredAt: at("2026-02-03T00:00:00.000Z"),
        kind: TransactionKind.Loan,
        amountRub: 10,
      },
    ] as const;

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
