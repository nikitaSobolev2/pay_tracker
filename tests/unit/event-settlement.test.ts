import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateAttendeeBalances,
  calculateEventTotals,
  calculatePaidProgress,
  calculatePerPersonShare,
  calculateSpendingTotal,
} from "../../src/server/services/event-settlement";
import {
  EventAttendanceStatus,
  EventSpendingCategory,
} from "../../src/types/enums";

function certain(id: string) {
  return { id, status: EventAttendanceStatus.Certain };
}

function uncertain(id: string) {
  return { id, status: EventAttendanceStatus.Uncertain };
}

describe("calculateSpendingTotal", () => {
  it("multiplies amount by price and rounds half up to money scale", () => {
    assert.equal(
      calculateSpendingTotal({
        category: EventSpendingCategory.Food,
        amount: "2.5",
        price: "199.99",
      }),
      "499.98",
    );
  });
});

describe("calculateEventTotals", () => {
  it("sums every row and groups it by category", () => {
    const totals = calculateEventTotals([
      {
        category: EventSpendingCategory.Food,
        amount: 2,
        price: 100,
      },
      {
        category: EventSpendingCategory.Food,
        amount: 1,
        price: 50,
      },
      {
        category: EventSpendingCategory.Drinks,
        amount: 3,
        price: 30,
      },
    ]);

    assert.equal(totals.total, "340.00");
    assert.deepEqual(totals.byCategory, [
      { category: EventSpendingCategory.Food, total: "250.00" },
      { category: EventSpendingCategory.Drinks, total: "90.00" },
    ]);
  });

  it("adds drinks and alcohol into one bar", () => {
    const totals = calculateEventTotals([
      { category: EventSpendingCategory.Drinks, amount: 1, price: 200 },
      { category: EventSpendingCategory.Alcohol, amount: 2, price: 400 },
      { category: EventSpendingCategory.Housing, amount: 1, price: 5000 },
    ]);

    assert.equal(totals.drinksAndAlcohol, "1000.00");
  });

  it("returns zero for an event without spendings", () => {
    const totals = calculateEventTotals([]);

    assert.equal(totals.total, "0.00");
    assert.deepEqual(totals.byCategory, []);
  });
});

describe("calculatePerPersonShare", () => {
  it("splits the total across everyone when all attendees are certain", () => {
    const share = calculatePerPersonShare({
      total: "1200",
      attendees: [certain("a"), certain("b"), certain("c")],
    });

    assert.equal(share.average, "400.00");
    assert.equal(share.lowerBound, "400.00");
    assert.equal(share.upperBound, "400.00");
    assert.equal(share.hasUncertain, false);
  });

  it("raises the upper bound to the certain-only split when someone is unsure", () => {
    const share = calculatePerPersonShare({
      total: "1200",
      attendees: [certain("a"), certain("b"), uncertain("c")],
    });

    assert.equal(share.lowerBound, "400.00");
    assert.equal(share.upperBound, "600.00");
    assert.equal(share.hasUncertain, true);
  });

  it("falls back to the average when nobody is certain", () => {
    const share = calculatePerPersonShare({
      total: "300",
      attendees: [uncertain("a"), uncertain("b")],
    });

    assert.equal(share.upperBound, "150.00");
  });

  it("returns zero without attendees", () => {
    const share = calculatePerPersonShare({ total: "500", attendees: [] });

    assert.equal(share.average, "0.00");
  });
});

describe("calculateAttendeeBalances", () => {
  it("sums several payments from the same attendee", () => {
    const balances = calculateAttendeeBalances({
      attendees: [certain("a")],
      payments: [
        { attendeeId: "a", amount: "100" },
        { attendeeId: "a", amount: "50" },
      ],
      share: "400",
    });

    assert.equal(balances[0]!.paid, "150.00");
    assert.equal(balances[0]!.remaining, "250.00");
    assert.equal(balances[0]!.hasPaidShare, false);
  });

  it("never reports a negative remaining for an overpayment", () => {
    const balances = calculateAttendeeBalances({
      attendees: [certain("a")],
      payments: [{ attendeeId: "a", amount: "500" }],
      share: "400",
    });

    assert.equal(balances[0]!.remaining, "0.00");
    assert.equal(balances[0]!.hasPaidShare, true);
  });
});

describe("calculatePaidProgress", () => {
  it("counts only attendees who covered the whole share", () => {
    const progress = calculatePaidProgress({
      attendees: [certain("a"), certain("b"), uncertain("c")],
      payments: [
        { attendeeId: "a", amount: "400" },
        { attendeeId: "b", amount: "399.99" },
      ],
      share: "400",
    });

    assert.equal(progress.paidCount, 1);
    assert.equal(progress.totalCount, 3);
    assert.equal(progress.certainPaidCount, 1);
    assert.equal(progress.uncertainPaidCount, 0);
  });

  it("reports collected against the expected full-list amount", () => {
    const progress = calculatePaidProgress({
      attendees: [certain("a"), uncertain("b")],
      payments: [
        { attendeeId: "a", amount: "400" },
        { attendeeId: "b", amount: "400" },
      ],
      share: "400",
    });

    assert.equal(progress.collected, "800.00");
    assert.equal(progress.expected, "800.00");
    assert.equal(progress.uncertainPaidCount, 1);
  });

  it("treats any payment as paid when the share is zero", () => {
    const progress = calculatePaidProgress({
      attendees: [certain("a"), certain("b")],
      payments: [{ attendeeId: "a", amount: "10" }],
      share: "0",
    });

    assert.equal(progress.paidCount, 1);
  });
});
