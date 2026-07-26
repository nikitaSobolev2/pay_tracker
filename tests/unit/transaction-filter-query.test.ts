import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterStatesEqual,
  filtersFromSearchParams,
  writeFiltersToSearchParams,
} from "../../src/features/transactions/transaction-filter-query";
import { DEFAULT_TRANSACTION_FILTERS } from "../../src/features/transactions/transaction-filter.types";
import { DateRangeType, TransactionKind } from "../../src/types/enums";

describe("filtersFromSearchParams", () => {
  it("returns defaults for empty params", () => {
    const filters = filtersFromSearchParams(new URLSearchParams());
    assert.deepEqual(filters, DEFAULT_TRANSACTION_FILTERS);
  });

  it("parses calendar, debt, categories, counterparties, and hide flag", () => {
    const params = new URLSearchParams({
      dateRangeType: "year",
      kinds: "DEFAULT,LOAN,DEBT,REFUND",
      categoryIds: "c1,c2",
      counterpartyIds: "p1",
      hideUncategorized: "true",
    });
    const filters = filtersFromSearchParams(params);
    assert.deepEqual(filters.datePreset, {
      kind: "calendar",
      range: DateRangeType.Year,
    });
    assert.deepEqual(filters.kinds, [
      TransactionKind.Loan,
      TransactionKind.Debt,
    ]);
    assert.deepEqual(filters.categoryIds, ["c1", "c2"]);
    assert.deepEqual(filters.counterpartyIds, ["p1"]);
    assert.equal(filters.hideUncategorized, true);
  });

  it("prefers absolute range over calendar type", () => {
    const params = new URLSearchParams({
      dateRangeType: "month",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
    const filters = filtersFromSearchParams(params);
    assert.deepEqual(filters.datePreset, {
      kind: "absolute",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
  });

  it("parses rolling window", () => {
    const params = new URLSearchParams({
      rollingUnit: "days",
      rollingN: "14",
    });
    const filters = filtersFromSearchParams(params);
    assert.deepEqual(filters.datePreset, {
      kind: "rolling",
      unit: "days",
      n: 14,
    });
  });
});

describe("writeFiltersToSearchParams", () => {
  it("omits default month and empty lists", () => {
    const params = new URLSearchParams({ type: "spending", junk: "1" });
    writeFiltersToSearchParams(params, DEFAULT_TRANSACTION_FILTERS);
    assert.equal(params.get("type"), "spending");
    assert.equal(params.get("junk"), "1");
    assert.equal(params.get("dateRangeType"), null);
    assert.equal(params.get("categoryIds"), null);
    assert.equal(params.get("hideUncategorized"), null);
  });

  it("round-trips non-default filters", () => {
    const filters = {
      datePreset: {
        kind: "rolling" as const,
        unit: "months" as const,
        n: 3,
      },
      kinds: [TransactionKind.Debt],
      categoryIds: ["cat-1"],
      counterpartyIds: ["cp-1"],
      hideUncategorized: true,
    };
    const params = new URLSearchParams();
    writeFiltersToSearchParams(params, filters);
    assert.ok(filterStatesEqual(filtersFromSearchParams(params), filters));
  });
});
