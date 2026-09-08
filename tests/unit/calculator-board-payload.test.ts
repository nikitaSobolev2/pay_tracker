import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculatorBoardQueryFromPage,
  normalizeBoardTitle,
  parseCalculatorBoardQuery,
  sanitizeCalculatorBoardWrite,
  transactionListParamsFromBoardQuery,
} from "../../src/features/transaction-calculator/calculator-board-payload";
import {
  EMPTY_CALCULATOR_SESSION,
  ME_PARTY_ID,
  type CalculatorSession,
} from "../../src/features/transaction-calculator/calculator-session";
import { calculatorSessionToJson } from "../../src/features/transaction-calculator/calculator-storage";
import { DateRangeType, TransactionType } from "../../src/types/enums";

describe("parseCalculatorBoardQuery", () => {
  it("keeps period filters and the period label", () => {
    const query = parseCalculatorBoardQuery({
      periodLabel: "This month",
      dateRangeType: DateRangeType.Month,
      type: TransactionType.Spending,
      categoryIds: ["c1"],
      hideUncategorized: true,
    });
    assert.equal(query.periodLabel, "This month");
    assert.equal(query.dateRangeType, DateRangeType.Month);
    assert.equal(query.type, TransactionType.Spending);
    assert.deepEqual(query.categoryIds, ["c1"]);
    assert.equal(query.hideUncategorized, true);
  });

  it("returns an empty label when the payload is invalid", () => {
    assert.deepEqual(parseCalculatorBoardQuery("nope"), { periodLabel: "" });
  });
});

describe("calculatorBoardQueryFromPage", () => {
  it("copies list filters and drops paging", () => {
    const query = calculatorBoardQueryFromPage(
      {
        dateRangeType: DateRangeType.Year,
        type: TransactionType.Earning,
        page: 2,
        pageSize: 20,
      },
      "  2026  ",
    );
    assert.equal(query.periodLabel, "2026");
    assert.equal(query.dateRangeType, DateRangeType.Year);
    assert.equal(query.type, TransactionType.Earning);
    assert.equal(transactionListParamsFromBoardQuery(query).page, undefined);
  });
});

describe("normalizeBoardTitle", () => {
  it("falls back when the title is blank", () => {
    assert.equal(normalizeBoardTitle("   "), "Board");
  });
});

describe("sanitizeCalculatorBoardWrite", () => {
  it("creates then updates the same sanitized payload", () => {
    const session: CalculatorSession = {
      selectedCounterpartyIds: ["p1"],
      activeWorkspaceId: ME_PARTY_ID,
      workspaces: {
        [ME_PARTY_ID]: {
          cuts: [],
          rawTransactions: [],
          boardColumn: {},
          expandedTargetIds: [ME_PARTY_ID],
          transfers: [],
        },
      },
    };
    const created = sanitizeCalculatorBoardWrite({
      title: "This month",
      query: {
        periodLabel: "This month",
        dateRangeType: DateRangeType.Month,
      },
      session: calculatorSessionToJson(session),
    });
    const updated = sanitizeCalculatorBoardWrite({
      title: created.title,
      query: created.query,
      session: calculatorSessionToJson(created.session),
    });
    assert.equal(created.title, "This month");
    assert.deepEqual(updated, created);
    assert.deepEqual(created.session, session);
  });

  it("drops corrupt session JSON on write", () => {
    const written = sanitizeCalculatorBoardWrite({
      title: "   ",
      query: "nope",
      session: { version: 99 },
    });
    assert.equal(written.title, "Board");
    assert.deepEqual(written.query, { periodLabel: "" });
    assert.deepEqual(written.session, EMPTY_CALCULATOR_SESSION);
  });
});
