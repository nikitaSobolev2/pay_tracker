import { toCeilIntegerAmountString, toDecimal } from "@/lib/money";
import type {
  DebtCounterpartyStats,
  DebtsStats,
} from "@/server/services/stats-service.types";

export type DebtReportTone = "owe" | "owed";

export type DebtReportRow = {
  readonly id: string;
  readonly name: string;
  readonly amount: string;
  readonly currency: string;
  readonly tone: DebtReportTone;
  readonly amountHistory: readonly string[];
};

export function debtReportRowsFromStats(stats: DebtsStats): DebtReportRow[] {
  return [
    ...rowsFromBucket(stats.myDebts.counterparties, "owe"),
    ...rowsFromBucket(stats.debtsToMe.counterparties, "owed"),
  ];
}

export function selectedDebtReportRows(
  rows: readonly DebtReportRow[],
  selectedIds: ReadonlySet<string>,
): DebtReportRow[] {
  return rows.filter((row) => selectedIds.has(row.id));
}

export function formatDebtReportText(rows: readonly DebtReportRow[]): string {
  if (rows.length === 0) {
    return "";
  }
  const expressions = rows.map((row) => formatDebtReportExpression(row));
  const nameWidth = maxStringLength(rows.map((row) => row.name));
  return rows
    .map((row, index) => {
      const name = row.name.padEnd(nameWidth, " ");
      return `${name} -> ${expressions[index]}`;
    })
    .join("\n");
}

export function formatDebtReportTotal(row: DebtReportRow): string {
  const parts = historyParts(row);
  const total = sumCeiledParts(parts);
  return row.tone === "owe" ? `-${total}` : total;
}

export function formatDebtReportHistory(row: DebtReportRow): string {
  const parts = historyParts(row);
  if (parts.length <= 1) {
    return "";
  }
  return formatHistoryParts(parts);
}

export function formatDebtReportExpression(row: DebtReportRow): string {
  const total = formatDebtReportTotal(row);
  const history = formatDebtReportHistory(row);
  if (!history) {
    return total;
  }
  return `${history} = ${total}`;
}

function historyParts(row: DebtReportRow): readonly string[] {
  return row.amountHistory.length > 0 ? row.amountHistory : [row.amount];
}

function formatHistoryParts(parts: readonly string[]): string {
  return parts
    .map((part, index) => {
      const units = ceilDebtUnits(part);
      const negative = toDecimal(part).isNegative();
      if (index === 0) {
        return negative ? `-${units}` : units;
      }
      return negative ? `- ${units}` : `+ ${units}`;
    })
    .join(" ");
}

function sumCeiledParts(parts: readonly string[]): string {
  let sum = toDecimal(0);
  for (const part of parts) {
    const units = toDecimal(ceilDebtUnits(part));
    sum = toDecimal(part).isNegative() ? sum.minus(units) : sum.plus(units);
  }
  return sum.abs().toFixed(0);
}

function ceilDebtUnits(raw: string): string {
  return toCeilIntegerAmountString(toDecimal(raw).abs().toString()) || "0";
}

function maxStringLength(values: readonly string[]): number {
  return values.reduce((max, value) => Math.max(max, value.length), 0);
}

function rowsFromBucket(
  counterparties: readonly DebtCounterpartyStats[],
  tone: DebtReportTone,
): DebtReportRow[] {
  return counterparties.map((person) => ({
    id: person.counterpartyId,
    name: person.name,
    amount: person.totalAllTime.amount,
    currency: person.totalAllTime.currency,
    tone,
    amountHistory: person.amountHistory ?? [],
  }));
}
