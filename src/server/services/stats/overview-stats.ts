import Decimal from "decimal.js";

import {
  daysInRange,
  getAbsoluteRangeBounds,
  getDateRangeBounds,
  getPreviousBoundsFromCurrent,
  getPreviousDateRangeBounds,
  type DateBounds,
} from "@/lib/dates";
import { decimalToString, toDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  DateRangeType,
  isCashflowExcludedKind,
  TransactionKind,
  TransactionType,
} from "@/types/enums";

import { convertRubToDisplay } from "../exchange-rate-service";
import type {
  MoneyAmount,
  NamedAmount,
  OverviewStats,
  OverviewStatsInput,
} from "../stats-service.types";
import { resolveTimelineBucket } from "@/lib/timeline-bucket";

import {
  buildCategorySlices,
  buildTimeline,
  comparisonFromAmounts,
  fetchRows,
  moneyOf,
  resolveDayCount,
  sortNamedAmountsDesc,
  sumDisplay,
} from "./stats-common";

export async function getOverviewStats(
  input: OverviewStatsInput,
): Promise<OverviewStats> {
  const bounds = resolveOverviewBounds(input);
  const { start, end } = bounds;
  const timelineBucket = resolveTimelineBucket({ start, end });
  const [periodRows, recentRows, debtSnapshot] = await Promise.all([
    fetchRows(input.userId, start, end),
    prisma.transaction.findMany({
      where: { userId: input.userId, isDeleted: false },
      include: {
        counterparty: true,
        categories: { include: { category: true } },
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
    aggregateNettedDebtSnapshots(input.userId, input.displayCurrency),
  ]);

  const { debtsIOwe, debtsOwedToMe } = debtSnapshot;

  const spendingRows = periodRows.filter(
    (row) =>
      row.type === TransactionType.Spending &&
      row.kind !== TransactionKind.Refund &&
      !isCashflowExcludedKind(row.kind),
  );
  const refundRows = periodRows.filter(
    (row) =>
      row.type === TransactionType.Spending &&
      row.kind === TransactionKind.Refund,
  );
  const earningRows = periodRows.filter(
    (row) =>
      row.type === TransactionType.Earning &&
      row.kind !== TransactionKind.Refund &&
      !isCashflowExcludedKind(row.kind),
  );

  const spendingTotal = (
    await sumDisplay(spendingRows, input.displayCurrency)
  ).minus(await sumDisplay(refundRows, input.displayCurrency));
  const earningTotal = await sumDisplay(earningRows, input.displayCurrency);
  const netTotal = earningTotal.minus(spendingTotal);

  const dayCount = await resolveDayCount(
    input.userId,
    input.dateRangeType,
    start,
    end,
  );
  const avgDailySpendAmount =
    dayCount > 0 ? spendingTotal.div(dayCount) : toDecimal(0);

  const previousPeriod = await loadPreviousPeriodTotals({
    userId: input.userId,
    timezone: input.timezone,
    displayCurrency: input.displayCurrency,
    dateRangeType: input.dateRangeType,
    currentBounds: bounds,
    useAbsolutePrevious: Boolean(input.startDate && input.endDate),
  });
  const vsPreviousPeriod = comparisonFromAmounts(
    netTotal,
    previousPeriod?.net ?? null,
    input.displayCurrency,
  );
  const avgDailySpendVsPrevious = comparisonFromAmounts(
    avgDailySpendAmount,
    previousPeriod?.avgDailySpend ?? null,
    input.displayCurrency,
  );

  const recentTransactions = await Promise.all(
    recentRows.map(async (row) => {
      const display = await convertRubToDisplay(
        row.amount.toString(),
        input.displayCurrency,
        row.fxRateDate,
      );
      return {
        id: row.id,
        type: row.type,
        title: row.title,
        occurredAt: row.occurredAt.toISOString(),
        displayAmount: display.amount,
        displayCurrency: display.currency,
        inputCurrency: row.inputCurrency,
        originalAmount: decimalToString(toDecimal(row.originalAmount.toString())),
      };
    }),
  );

  const timeline = await buildTimeline(
    periodRows,
    timelineBucket,
    input.timezone,
    start,
    end,
    input.displayCurrency,
  );

  return {
    displayCurrency: input.displayCurrency,
    dateRangeType: input.dateRangeType,
    debtsIOwe,
    debtsOwedToMe,
    spendingByCategory: await buildCategorySlices(
      input.userId,
      spendingRows,
      input.displayCurrency,
    ),
    earningByCategory: await buildCategorySlices(
      input.userId,
      earningRows,
      input.displayCurrency,
    ),
    timeline,
    incomeVsSpending: {
      income: moneyOf(earningTotal, input.displayCurrency),
      spending: moneyOf(spendingTotal, input.displayCurrency),
      net: moneyOf(netTotal, input.displayCurrency),
    },
    incomeExpenseBars: timeline,
    avgDailySpend: moneyOf(avgDailySpendAmount, input.displayCurrency),
    avgDailySpendVsPrevious,
    periodTotal: moneyOf(netTotal, input.displayCurrency),
    recentTransactions,
    vsPreviousPeriod,
  };
}

/**
 * Net each counterparty as (what they owe me / LOAN) − (what I owe them / DEBT).
 * Positive → "owed to me"; negative → "I'm in debt"; zero → omitted.
 *
 * Aggregated in Postgres by (counterparty, role, fxRateDate) so we never pull
 * the full debt ledger into Node just to net it.
 */
async function aggregateNettedDebtSnapshots(
  userId: string,
  displayCurrency: string,
): Promise<{
  debtsIOwe: { total: MoneyAmount; breakdown: NamedAmount[] };
  debtsOwedToMe: { total: MoneyAmount; breakdown: NamedAmount[] };
}> {
  const groups = await prisma.transaction.groupBy({
    by: ["counterpartyId", "kind", "fxRateDate"],
    where: {
      userId,
      isDeleted: false,
      kind: { in: [TransactionKind.Loan, TransactionKind.Debt] },
    },
    _sum: { amount: true },
  });

  const netByParty = new Map<string, Decimal>();
  for (const group of groups) {
    if (!group._sum.amount) {
      continue;
    }
    const key = group.counterpartyId ?? "unknown";
    const display = await convertRubToDisplay(
      group._sum.amount.toString(),
      displayCurrency,
      group.fxRateDate,
    );
    const signed =
      group.kind === TransactionKind.Loan
        ? toDecimal(display.amount)
        : toDecimal(display.amount).neg();
    netByParty.set(key, (netByParty.get(key) ?? toDecimal(0)).plus(signed));
  }

  const names = await loadCounterpartyNames(userId, [...netByParty.keys()]);
  const iOweBreakdown: NamedAmount[] = [];
  const owedToMeBreakdown: NamedAmount[] = [];
  let iOweTotal = toDecimal(0);
  let owedToMeTotal = toDecimal(0);

  for (const [key, balance] of netByParty) {
    if (balance.isZero()) {
      continue;
    }
    const entry: NamedAmount = {
      id: key === "unknown" ? null : key,
      name: names.get(key) ?? "Unknown",
      amount: decimalToString(balance.abs()),
    };
    if (balance.gt(0)) {
      owedToMeBreakdown.push(entry);
      owedToMeTotal = owedToMeTotal.plus(balance);
    } else {
      iOweBreakdown.push(entry);
      iOweTotal = iOweTotal.plus(balance.abs());
    }
  }

  sortNamedAmountsDesc(iOweBreakdown);
  sortNamedAmountsDesc(owedToMeBreakdown);

  return {
    debtsIOwe: {
      total: moneyOf(iOweTotal, displayCurrency),
      breakdown: iOweBreakdown,
    },
    debtsOwedToMe: {
      total: moneyOf(owedToMeTotal, displayCurrency),
      breakdown: owedToMeBreakdown,
    },
  };
}

async function loadCounterpartyNames(
  userId: string,
  keys: string[],
): Promise<Map<string, string>> {
  const ids = keys.filter((key) => key !== "unknown");
  if (ids.length === 0) {
    return new Map();
  }
  const parties = await prisma.userCounterparty.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(parties.map((party) => [party.id, party.name]));
}

function resolveOverviewBounds(input: OverviewStatsInput): DateBounds {
  if (input.startDate && input.endDate) {
    return getAbsoluteRangeBounds(
      input.startDate,
      input.endDate,
      input.timezone,
    );
  }
  return getDateRangeBounds(input.dateRangeType, input.timezone);
}

async function loadPreviousPeriodTotals(input: {
  userId: string;
  timezone: string;
  displayCurrency: string;
  dateRangeType: DateRangeType;
  currentBounds: DateBounds;
  useAbsolutePrevious: boolean;
}): Promise<{
  net: Decimal;
  avgDailySpend: Decimal;
} | null> {
  if (input.dateRangeType === DateRangeType.AllTime && !input.useAbsolutePrevious) {
    return null;
  }
  const previousBounds = input.useAbsolutePrevious
    ? getPreviousBoundsFromCurrent(input.currentBounds)
    : getPreviousDateRangeBounds(input.dateRangeType, input.timezone);
  if (!previousBounds.start || !previousBounds.end) {
    return null;
  }
  const previousRows = await fetchRows(
    input.userId,
    previousBounds.start,
    previousBounds.end,
  );
  const previousSpending = (
    await sumDisplay(
      previousRows.filter(
        (row) =>
          row.type === TransactionType.Spending &&
          row.kind !== TransactionKind.Refund &&
          !isCashflowExcludedKind(row.kind),
      ),
      input.displayCurrency,
    )
  ).minus(
    await sumDisplay(
      previousRows.filter(
        (row) =>
          row.type === TransactionType.Spending &&
          row.kind === TransactionKind.Refund,
      ),
      input.displayCurrency,
    ),
  );
  const previousEarning = await sumDisplay(
    previousRows.filter(
      (row) =>
        row.type === TransactionType.Earning &&
        row.kind !== TransactionKind.Refund &&
        !isCashflowExcludedKind(row.kind),
    ),
    input.displayCurrency,
  );
  const previousDayCount = daysInRange(
    previousBounds.start,
    previousBounds.end,
  );
  return {
    net: previousEarning.minus(previousSpending),
    avgDailySpend:
      previousDayCount > 0
        ? previousSpending.div(previousDayCount)
        : toDecimal(0),
  };
}
