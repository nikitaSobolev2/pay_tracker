import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildEventSummary } from "../../src/server/services/event-summary";
import {
  EventAttendanceStatus,
  EventSpendingCategory,
} from "../../src/types/enums";

const attendees = [
  { id: "a", name: "Anna", status: EventAttendanceStatus.Certain },
  { id: "b", name: "Boris", status: EventAttendanceStatus.Certain },
  { id: "c", name: "Clara", status: EventAttendanceStatus.Uncertain },
];

const spendings = [
  { category: EventSpendingCategory.Food, amount: 3, price: 200 },
  { category: EventSpendingCategory.Alcohol, amount: 2, price: 150 },
];

describe("buildEventSummary", () => {
  it("splits the total across certain and uncertain attendees", () => {
    const summary = buildEventSummary({
      attendees,
      spendings,
      payments: [],
    });

    assert.equal(summary.total, "900.00");
    assert.equal(summary.share.average, "300.00");
    assert.equal(summary.share.upperBound, "450.00");
    assert.equal(summary.share.hasUncertain, true);
  });

  it("labels every balance with the attendee name", () => {
    const summary = buildEventSummary({
      attendees,
      spendings,
      payments: [{ attendeeId: "b", amount: "300" }],
    });

    const boris = summary.balances.find(
      (balance) => balance.attendeeId === "b",
    );
    assert.equal(boris?.name, "Boris");
    assert.equal(boris?.paid, "300.00");
    assert.equal(boris?.hasPaidShare, true);
  });

  it("reports paid progress against the whole attendee list", () => {
    const summary = buildEventSummary({
      attendees,
      spendings,
      payments: [
        { attendeeId: "a", amount: "300" },
        { attendeeId: "c", amount: "100" },
      ],
    });

    assert.equal(summary.paidProgress.paidCount, 1);
    assert.equal(summary.paidProgress.totalCount, 3);
    assert.equal(summary.paidProgress.collected, "400.00");
    assert.equal(summary.paidProgress.expected, "900.00");
  });

  it("keeps drinks and alcohol visible for an event without payments", () => {
    const summary = buildEventSummary({
      attendees,
      spendings,
      payments: [],
    });

    assert.equal(summary.drinksAndAlcohol, "300.00");
  });

  it("uses the manual per-person amount for share, balances, and expected", () => {
    const summary = buildEventSummary({
      attendees,
      spendings,
      payments: [{ attendeeId: "a", amount: "500" }],
      manualPerPersonAmount: "500",
    });

    assert.equal(summary.share.average, "500.00");
    assert.equal(summary.share.lowerBound, "500.00");
    assert.equal(summary.share.upperBound, "500.00");
    assert.equal(summary.share.hasUncertain, false);
    assert.equal(summary.paidProgress.expected, "1500.00");

    const anna = summary.balances.find(
      (balance) => balance.attendeeId === "a",
    );
    assert.equal(anna?.share, "500.00");
    assert.equal(anna?.hasPaidShare, true);
  });

  it("falls back to computed share when manual amount is cleared", () => {
    const summary = buildEventSummary({
      attendees,
      spendings,
      payments: [],
      manualPerPersonAmount: null,
    });

    assert.equal(summary.share.average, "300.00");
    assert.equal(summary.share.hasUncertain, true);
  });
});
