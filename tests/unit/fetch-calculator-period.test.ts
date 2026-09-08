import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculatorLedgerQuery,
  calculatorPeriodQuery,
} from "../../src/features/transaction-calculator/fetch-calculator-period";
import {
  DateRangeType,
  TransactionKind,
  TransactionSortBy,
  TransactionType,
} from "../../src/types/enums";

const PAGE_QUERY = {
  dateRangeType: DateRangeType.Month,
  type: TransactionType.Spending,
  kinds: [TransactionKind.Default],
  categoryIds: ["cat-1"],
  counterpartyIds: ["p1"],
  travelId: "trip-1",
  hideUncategorized: true,
  sortBy: TransactionSortBy.Amount,
  sortDir: "desc" as const,
  page: 2,
  pageSize: 20,
};

describe("calculatorPeriodQuery", () => {
  it("keeps the transaction page filters except paging and sort", () => {
    assert.deepEqual(calculatorPeriodQuery(PAGE_QUERY), {
      dateRangeType: DateRangeType.Month,
      rollingUnit: undefined,
      rollingN: undefined,
      startDate: undefined,
      endDate: undefined,
      type: TransactionType.Spending,
      kinds: [TransactionKind.Default],
      categoryIds: ["cat-1"],
      counterpartyIds: ["p1"],
      travelId: "trip-1",
      hideUncategorized: true,
    });
  });
});

describe("calculatorLedgerQuery", () => {
  it("loads loans and debts for the same date range only", () => {
    assert.deepEqual(calculatorLedgerQuery(PAGE_QUERY), {
      dateRangeType: DateRangeType.Month,
      rollingUnit: undefined,
      rollingN: undefined,
      startDate: undefined,
      endDate: undefined,
      kinds: [TransactionKind.Loan, TransactionKind.Debt],
    });
  });
});
