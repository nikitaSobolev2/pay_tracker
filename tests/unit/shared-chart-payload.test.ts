import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SharedChartType,
  parseSharedChartPayload,
} from "../../src/features/share/shared-chart-payload";
import { DateRangeType, TransactionType } from "../../src/types/enums";

describe("parseSharedChartPayload", () => {
  it("accepts a timeline snapshot", () => {
    const payload = parseSharedChartPayload({
      type: SharedChartType.Timeline,
      title: "Over time",
      currency: "RUB",
      mode: "dual",
      points: [
        {
          bucket: "2026-01",
          spending: "100",
          earning: "200",
          net: "100",
        },
      ],
    });
    assert.equal(payload.type, SharedChartType.Timeline);
    if (payload.type === SharedChartType.Timeline) {
      assert.equal(payload.points.length, 1);
    }
  });

  it("accepts a category pie snapshot with children", () => {
    const payload = parseSharedChartPayload({
      type: SharedChartType.CategoryPie,
      title: "Pie",
      currency: "RUB",
      slices: [
        {
          categoryId: "c1",
          title: "Food",
          type: TransactionType.Spending,
          amount: "50",
          percent: 100,
          children: [],
        },
      ],
    });
    assert.equal(payload.type, SharedChartType.CategoryPie);
  });

  it("accepts vs-previous and money value snapshots", () => {
    parseSharedChartPayload({
      type: SharedChartType.VsPrevious,
      title: "Vs",
      dateRangeType: DateRangeType.Month,
      comparison: {
        current: { amount: "10", currency: "RUB" },
        previous: { amount: "8", currency: "RUB" },
        deltaAmount: "2",
        deltaPercent: 25,
      },
    });
    parseSharedChartPayload({
      type: SharedChartType.MoneyValue,
      title: "Avg",
      amount: { amount: "12", currency: "RUB" },
      hideComparison: true,
    });
  });

  it("rejects unknown chart types", () => {
    assert.throws(() =>
      parseSharedChartPayload({
        type: "unknown",
        title: "Nope",
      }),
    );
  });
});
