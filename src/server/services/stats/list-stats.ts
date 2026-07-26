import Decimal from "decimal.js";

import {
  daysInRange,
  elapsedDaysInRange,
  getPreviousBoundsFromCurrent,
  getPreviousDateRangeBounds,
} from "@/lib/dates";
import { toDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  DateRangeType,
  TransactionKind,
  TransactionType,
} from "@/types/enums";

import { hasMultipleCurrenciesForUser } from "../exchange-rate-service";
import type {
  ListPageStats,
  ListPageStatsInput,
} from "../stats-service.types";
import {
  buildTransactionWhere,
  resolveListDateBounds,
} from "../transaction-service";
import { resolveTimelineBucket } from "@/lib/timeline-bucket";

import {
  buildCategoryActivity,
  buildCategorySlices,
  buildCurrencyBreakdown,
  buildTimeline,
  comparisonFromAmounts,
  moneyOf,
  resolveDayCount,
  sumDisplay,
  sumDisplayGrouped,
} from "./stats-common";

export async function getListPageStats(
  input: ListPageStatsInput,
): Promise<ListPageStats> {
  const bounds = resolveListDateBounds(input);
  const isAllTime = !bounds.start && !bounds.end;
  const timelineRangeType = resolveTimelineRangeType(input);
  const timelineBucket = resolveTimelineBucket(bounds);
  const where = buildTransactionWhere(input);

  const previousBounds =
    input.rollingUnit || (input.startDate && input.endDate)
      ? getPreviousBoundsFromCurrent(bounds)
      : getPreviousDateRangeBounds(
          input.dateRangeType ?? DateRangeType.Month,
          input.timezone,
        );
  const previousWhere = buildTransactionWhere({
    ...input,
    dateRangeType: undefined,
    rollingUnit: undefined,
    rollingN: undefined,
    startDate: undefined,
    endDate: undefined,
  });
  if (previousBounds.start || previousBounds.end) {
    previousWhere.occurredAt = {
      ...(previousBounds.start ? { gte: previousBounds.start } : {}),
      ...(previousBounds.end ? { lte: previousBounds.end } : {}),
    };
  }

  const [rows, previousTotal, previousCount, multiCurrency] =
    await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          counterparty: true,
          categories: { include: { category: true } },
        },
      }),
      isAllTime
        ? Promise.resolve(null)
        : sumDisplayGrouped(previousWhere, input.displayCurrency),
      isAllTime
        ? Promise.resolve(0)
        : prisma.transaction.count({ where: previousWhere }),
      hasMultipleCurrenciesForUser(input.userId),
    ]);

  const spendingTotal = (
    await sumDisplay(
      rows.filter(
        (row) =>
          row.type === TransactionType.Spending &&
          row.kind !== TransactionKind.Refund,
      ),
      input.displayCurrency,
    )
  ).minus(
    await sumDisplay(
      rows.filter(
        (row) =>
          row.type === TransactionType.Spending &&
          row.kind === TransactionKind.Refund,
      ),
      input.displayCurrency,
    ),
  );
  const earningTotal = await sumDisplay(
    rows.filter(
      (row) =>
        row.type === TransactionType.Earning &&
        row.kind !== TransactionKind.Refund,
    ),
    input.displayCurrency,
  );
  const scopedTotal = input.type
    ? await sumDisplay(rows, input.displayCurrency)
    : spendingTotal.plus(earningTotal);
  const netTotal = earningTotal.minus(spendingTotal);
  const count = rows.length;
  const dayCount =
    bounds.start && bounds.end
      ? elapsedDaysInRange(bounds.start, bounds.end)
      : await resolveDayCount(
          input.userId,
          timelineRangeType,
          bounds.start,
          bounds.end,
        );

  const [categoryPie, categoryActivity] = await Promise.all([
    buildCategorySlices(input.userId, rows, input.displayCurrency),
    buildCategoryActivity(input.userId, rows, input.displayCurrency),
  ]);
  const topCategories = [...categoryPie]
    .sort((a, b) => toDecimal(b.amount).cmp(toDecimal(a.amount)))
    .slice(0, 8);

  const vsPreviousPeriod = comparisonFromAmounts(
    scopedTotal,
    previousTotal,
    input.displayCurrency,
  );

  const avgPerTransactionAmount =
    count > 0 ? scopedTotal.div(count) : toDecimal(0);
  const avgPerDayAmount =
    dayCount > 0 ? scopedTotal.div(dayCount) : toDecimal(0);

  const previousDayCount = await resolvePreviousDayCount(
    isAllTime,
    input.userId,
    timelineRangeType,
    previousBounds.start,
    previousBounds.end,
  );
  const previousAvgPerTransaction = previousAverage(
    previousTotal,
    previousCount,
  );
  const previousAvgPerDay = previousAverage(previousTotal, previousDayCount);

  return {
    displayCurrency: input.displayCurrency,
    dateRangeType: timelineRangeType,
    hasMultipleCurrencies: multiCurrency,
    periodTotals: {
      count,
      spending: moneyOf(spendingTotal, input.displayCurrency),
      earning: moneyOf(earningTotal, input.displayCurrency),
      net: moneyOf(netTotal, input.displayCurrency),
      total: moneyOf(scopedTotal, input.displayCurrency),
    },
    avgPerTransaction: moneyOf(avgPerTransactionAmount, input.displayCurrency),
    avgPerDay: moneyOf(avgPerDayAmount, input.displayCurrency),
    avgPerTransactionVsPrevious: comparisonFromAmounts(
      avgPerTransactionAmount,
      previousAvgPerTransaction,
      input.displayCurrency,
    ),
    avgPerDayVsPrevious: comparisonFromAmounts(
      avgPerDayAmount,
      previousAvgPerDay,
      input.displayCurrency,
    ),
    timeline: await buildTimeline(
      rows,
      timelineBucket,
      input.timezone,
      bounds.start,
      bounds.end,
      input.displayCurrency,
    ),
    categoryPie,
    categoryActivity,
    topCategories,
    currencyBreakdown: multiCurrency ? buildCurrencyBreakdown(rows) : null,
    vsPreviousPeriod,
  };
}

function resolveTimelineRangeType(input: ListPageStatsInput): DateRangeType {
  if (input.startDate && input.endDate) {
    const daySpan =
      (Date.parse(input.endDate) - Date.parse(input.startDate)) /
        (24 * 60 * 60 * 1000) +
      1;
    if (daySpan <= 45) {
      return DateRangeType.Day;
    }
    if (daySpan <= 400) {
      return DateRangeType.Month;
    }
    return DateRangeType.Year;
  }
  if (input.rollingUnit === "days") {
    return DateRangeType.Day;
  }
  if (input.rollingUnit === "months") {
    return DateRangeType.Month;
  }
  if (input.rollingUnit === "years") {
    return DateRangeType.Year;
  }
  return input.dateRangeType ?? DateRangeType.Month;
}

async function resolvePreviousDayCount(
  isAllTime: boolean,
  userId: string,
  dateRangeType: DateRangeType,
  start: Date | null,
  end: Date | null,
): Promise<number> {
  if (isAllTime) {
    return 0;
  }
  if (start && end) {
    return daysInRange(start, end);
  }
  return resolveDayCount(userId, dateRangeType, start, end);
}

function previousAverage(
  previousTotal: Decimal | null,
  divisor: number,
): Decimal | null {
  if (previousTotal == null) {
    return null;
  }
  if (divisor <= 0) {
    return toDecimal(0);
  }
  return previousTotal.div(divisor);
}
