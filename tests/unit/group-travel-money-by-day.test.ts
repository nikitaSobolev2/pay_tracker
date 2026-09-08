import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  groupTravelMoneyByDay,
  sumTravelDayNets,
  sumTravelMoneyTotals,
} from "@/lib/group-travel-money-by-day";
import { TransactionType } from "@/types/enums";

describe("groupTravelMoneyByDay", () => {
  it("groups spend and earn by day and computes net as spend minus earn", () => {
    const days = groupTravelMoneyByDay([
      {
        occurredAt: "2026-06-02T10:00:00.000Z",
        displayAmount: "40",
        type: TransactionType.Spending,
      },
      {
        occurredAt: "2026-06-01T08:00:00.000Z",
        displayAmount: "100",
        type: TransactionType.Spending,
      },
      {
        occurredAt: "2026-06-01T12:00:00.000Z",
        displayAmount: "30",
        type: TransactionType.Earning,
      },
    ]);
    assert.deepEqual(days, [
      { date: "2026-06-01", spending: 100, earning: 30, net: 70 },
      { date: "2026-06-02", spending: 40, earning: 0, net: 40 },
    ]);
  });

  it("returns empty list when there are no transactions", () => {
    assert.deepEqual(groupTravelMoneyByDay([]), []);
  });
});

describe("sumTravelDayNets", () => {
  it("sums daily net expenses", () => {
    assert.equal(
      sumTravelDayNets([
        { date: "2026-06-01", spending: 100, earning: 30, net: 70 },
        { date: "2026-06-02", spending: 40, earning: 0, net: 40 },
      ]),
      110,
    );
  });
});

describe("sumTravelMoneyTotals", () => {
  it("sums spending, earning, and net across days", () => {
    assert.deepEqual(
      sumTravelMoneyTotals([
        { date: "2026-06-01", spending: 100, earning: 30, net: 70 },
        { date: "2026-06-02", spending: 40, earning: 0, net: 40 },
      ]),
      { spending: 140, earning: 30, net: 110 },
    );
  });
});
