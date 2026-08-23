import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  debtReportRowsFromStats,
  formatDebtReportExpression,
  formatDebtReportHistory,
  formatDebtReportText,
  formatDebtReportTotal,
  selectedDebtReportRows,
  type DebtReportRow,
} from "../../src/lib/debt-report-text";
import type {
  DebtCounterpartyStats,
  DebtsStats,
  MoneyAmount,
} from "../../src/server/services/stats-service.types";

describe("formatDebtReportText", () => {
  it("formats name arrow amount", () => {
    const text = formatDebtReportText([owedRow("Anna", "1200")]);
    assert.equal(text, "Anna -> 1200");
  });

  it("uses a negative amount for I-owe rows", () => {
    assert.equal(formatDebtReportText([oweRow("Bob", "800")]), "Bob -> -800");
  });

  it("returns an empty string when there are no rows", () => {
    assert.equal(formatDebtReportText([]), "");
  });

  it("left-aligns the amount column on the first row", () => {
    const text = formatDebtReportText([
      owedRow("Alexander", "800"),
      owedRow("Al", "10"),
    ]);
    const [first, second] = text.split("\n");
    assert.equal(first?.indexOf(" -> "), second?.indexOf(" -> "));
    assert.equal(first?.indexOf("800"), second?.indexOf("10"));
  });

  it("shows ceiled history like 100 + 500 = 600", () => {
    assert.equal(
      formatDebtReportText([owedRow("Anna", "600", ["100", "500"])]),
      "Anna -> 100 + 500 = 600",
    );
    assert.equal(
      formatDebtReportText([owedRow("Cara", "600.2", ["100.1", "500.1"])]),
      "Cara -> 101 + 501 = 602",
    );
  });

  it("uses minus in history for repayments", () => {
    const expression = formatDebtReportExpression(
      oweRow("Bob", "600", ["1000", "-400"]),
    );
    assert.equal(expression, "1000 - 400 = -600");
  });

  it("keeps image total separate from wrapped history", () => {
    const row = owedRow("Anna", "600", ["100", "500"]);
    assert.equal(formatDebtReportTotal(row), "600");
    assert.equal(formatDebtReportHistory(row), "100 + 500");
    assert.equal(formatDebtReportHistory(owedRow("Bob", "80")), "");
  });
});

describe("selectedDebtReportRows", () => {
  it("keeps only selected people in original order", () => {
    const rows = [owedRow("Anna", "10"), oweRow("Bob", "20"), owedRow("Cara", "30")];
    rows[2] = { ...rows[2]!, id: "cara" };
    const selected = selectedDebtReportRows(rows, new Set(["anna", "cara"]));
    assert.deepEqual(
      selected.map((row) => row.id),
      ["anna", "cara"],
    );
  });
});

describe("debtReportRowsFromStats", () => {
  it("merges I-owe then owed-to-me nets", () => {
    const rows = debtReportRowsFromStats(statsWithPeople());
    assert.deepEqual(
      rows.map((row) => ({ id: row.id, tone: row.tone })),
      [
        { id: "bob", tone: "owe" },
        { id: "anna", tone: "owed" },
      ],
    );
  });
});

function owedRow(
  name: string,
  amount: string,
  amountHistory: readonly string[] = [],
): DebtReportRow {
  return {
    id: name.toLowerCase(),
    name,
    amount,
    currency: "USD",
    tone: "owed",
    amountHistory,
  };
}

function oweRow(
  name: string,
  amount: string,
  amountHistory: readonly string[] = [],
): DebtReportRow {
  return {
    id: name.toLowerCase(),
    name,
    amount,
    currency: "USD",
    tone: "owe",
    amountHistory,
  };
}

function money(amount: string): MoneyAmount {
  return { amount, currency: "USD" };
}

function person(id: string, name: string, amount: string): DebtCounterpartyStats {
  return {
    counterpartyId: id,
    name,
    totalThisMonth: money("0"),
    totalAllTime: money(amount),
    averageAmount: money(amount),
    frequencyDays: null,
    medianSettleDays: null,
    eventCount: 1,
    recentAmounts: [],
    amountHistory: [],
  };
}

function statsWithPeople(): DebtsStats {
  const emptyBucket = {
    totalAllTime: money("0"),
    totalThisMonth: money("0"),
    medianSettleDays: null,
    counterparties: [] as DebtCounterpartyStats[],
  };
  return {
    displayCurrency: "USD",
    medianSettleDays: null,
    forgivenAllTime: money("0"),
    myDebts: {
      ...emptyBucket,
      counterparties: [person("bob", "Bob", "800")],
    },
    debtsToMe: {
      ...emptyBucket,
      counterparties: [person("anna", "Anna", "1200")],
    },
  };
}
