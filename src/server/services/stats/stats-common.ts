import { Prisma } from "@prisma/client";
import {
  eachDayOfInterval,
  eachHourOfInterval,
  eachMonthOfInterval,
  eachYearOfInterval,
  format,
  max as maxDate,
  min as minDate,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import Decimal from "decimal.js";

import { listCategoryAncestorIds } from "@/lib/category-ancestors";
import {
  attributeCashflowAmount,
  categoryAttributionType,
  categorySignedAmount,
  includeRowInCashflow,
} from "@/lib/cashflow-kinds";
import { daysInRange, elapsedDaysInRange } from "@/lib/dates";
import { debtBalanceDelta, isDebtLedgerKind } from "@/lib/debt-episodes";
import { decimalToString, toDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { TimelineBucket } from "@/lib/timeline-bucket";
import {
  DateRangeType,
  isCashflowExcludedKind,
  TransactionKind,
  TransactionType,
} from "@/types/enums";

import {
  loadCategoryAncestorMap,
  resolveDirectChildUnderRoot,
  resolveRootCategoryId,
} from "../category-service";
import { convertRubToDisplay } from "../exchange-rate-service";
import type {
  CategoryActivity,
  CategorySlice,
  MoneyAmount,
  NamedAmount,
  PeriodComparison,
  TimelinePoint,
} from "../stats-service.types";

export {
  attributeCashflowAmount,
  categoryAttributionType,
  categorySignedAmount,
  includeRowInCashflow,
  includeRowInDefaultCashflow,
  isSingleKindFilter,
} from "@/lib/cashflow-kinds";

export type TxRow = {
  id: string;
  type: TransactionType;
  amount: { toString(): string };
  inputCurrency: string;
  originalAmount: { toString(): string };
  fxRateDate: Date;
  title: string | null;
  occurredAt: Date;
  kind: TransactionKind;
  sourceTransactionId: string | null;
  counterpartyId: string | null;
  counterparty: { id: string; name: string } | null;
  categories: Array<{
    categoryId: string;
    category: {
      id: string;
      title: string;
      type: TransactionType;
      parentCategoryId: string | null;
    };
  }>;
};

export function moneyOf(amount: Decimal, currency: string): MoneyAmount {
  return { amount: decimalToString(amount), currency };
}

export async function rowDisplayAmount(
  row: TxRow,
  displayCurrency: string,
): Promise<Decimal> {
  const display = await convertRubToDisplay(
    row.amount.toString(),
    displayCurrency,
    row.fxRateDate,
  );
  return toDecimal(display.amount);
}

export async function sumDisplay(
  rows: TxRow[],
  displayCurrency: string,
): Promise<Decimal> {
  let total = toDecimal(0);
  for (const row of rows) {
    total = total.plus(await rowDisplayAmount(row, displayCurrency));
  }
  return total;
}

/**
 * DB-side sum: canonical amounts are RUB, and conversion is linear per
 * fxRateDate, so we group+SUM in Postgres and convert one value per distinct
 * date instead of pulling every row into Node.
 */
export async function sumDisplayGrouped(
  where: Prisma.TransactionWhereInput,
  displayCurrency: string,
): Promise<Decimal> {
  const groups = await prisma.transaction.groupBy({
    by: ["fxRateDate"],
    where: { ...where, isDeleted: false },
    _sum: { amount: true },
  });
  let total = toDecimal(0);
  for (const group of groups) {
    if (!group._sum.amount) {
      continue;
    }
    const display = await convertRubToDisplay(
      group._sum.amount.toString(),
      displayCurrency,
      group.fxRateDate,
    );
    total = total.plus(toDecimal(display.amount));
  }
  return total;
}

export async function fetchRows(
  userId: string,
  start: Date | null,
  end: Date | null,
  type?: TransactionType,
): Promise<TxRow[]> {
  return prisma.transaction.findMany({
    where: {
      userId,
      isDeleted: false,
      ...(type ? { type } : {}),
      ...(start || end
        ? {
            occurredAt: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
    },
    include: {
      counterparty: true,
      categories: { include: { category: true } },
    },
  });
}

export async function resolveDayCount(
  userId: string,
  dateRangeType: DateRangeType,
  start: Date | null,
  end: Date | null,
): Promise<number> {
  if (dateRangeType !== DateRangeType.AllTime) {
    return elapsedDaysInRange(start, end);
  }
  const first = await prisma.transaction.findFirst({
    where: { userId, isDeleted: false },
    orderBy: { occurredAt: "asc" },
    select: { occurredAt: true },
  });
  if (!first) {
    return 0;
  }
  return daysInRange(first.occurredAt, new Date());
}

export function comparisonFromAmounts(
  currentAmount: Decimal,
  previousAmount: Decimal | null,
  displayCurrency: string,
): PeriodComparison {
  const current = moneyOf(currentAmount, displayCurrency);
  if (previousAmount == null) {
    return {
      current,
      previous: null,
      deltaAmount: null,
      deltaPercent: null,
    };
  }
  const previous = moneyOf(previousAmount, displayCurrency);
  const delta = currentAmount.minus(previousAmount);
  const deltaPercent = previousAmount.eq(0)
    ? null
    : Number(delta.div(previousAmount).mul(100).toFixed(2));
  return {
    current,
    previous,
    deltaAmount: decimalToString(delta),
    deltaPercent,
  };
}

/**
 * Amounts for every category in each assignment's ancestor chain (leaf → root).
 * Needed by the categories list: pie slices only expose root + one child level.
 */
export async function buildCategoryActivity(
  userId: string,
  rows: TxRow[],
  displayCurrency: string,
  kindsFilter?: readonly TransactionKind[],
): Promise<CategoryActivity[]> {
  const assignedIds = rows.flatMap((row) =>
    row.categories.map((link) => link.categoryId),
  );
  const byId = await loadCategoryAncestorMap(userId, assignedIds);
  const buckets = new Map<string, { type: TransactionType; amount: Decimal }>();
  const totalByType = new Map<TransactionType, Decimal>();

  for (const row of rows) {
    if (!includeRowInCashflow(row.kind, kindsFilter, row.sourceTransactionId)) {
      continue;
    }
    const display = await rowDisplayAmount(row, displayCurrency);
    const signed = categorySignedAmount(display);
    const attributionType = categoryAttributionType(row);
    totalByType.set(
      attributionType,
      (totalByType.get(attributionType) ?? toDecimal(0)).plus(signed),
    );
    if (row.categories.length === 0) {
      continue;
    }
    const share = signed.div(row.categories.length);
    for (const link of row.categories) {
      for (const categoryId of listCategoryAncestorIds(link.categoryId, byId)) {
        const key = `${attributionType}:${categoryId}`;
        const current = buckets.get(key) ?? {
          type: attributionType,
          amount: toDecimal(0),
        };
        current.amount = current.amount.plus(share);
        buckets.set(key, current);
      }
    }
  }

  const activities: CategoryActivity[] = [];
  for (const [key, value] of buckets) {
    const categoryId = key.slice(key.indexOf(":") + 1);
    const typeTotal = totalByType.get(value.type) ?? toDecimal(0);
    activities.push({
      categoryId,
      type: value.type,
      amount: decimalToString(value.amount),
      percent: typeTotal.gt(0)
        ? Number(value.amount.div(typeTotal).mul(100).toFixed(2))
        : 0,
    });
  }
  activities.sort((left, right) =>
    toDecimal(right.amount).cmp(toDecimal(left.amount)),
  );
  return activities;
}

export async function buildCategorySlices(
  userId: string,
  rows: TxRow[],
  displayCurrency: string,
  kindsFilter?: readonly TransactionKind[],
): Promise<CategorySlice[]> {
  const assignedIds = rows.flatMap((row) =>
    row.categories.map((link) => link.categoryId),
  );
  const byId = await loadCategoryAncestorMap(userId, assignedIds);

  type RootBucket = {
    categoryId: string | null;
    title: string;
    type: TransactionType;
    amount: Decimal;
  };
  const rootBuckets = new Map<string, RootBucket>();
  const childBuckets = new Map<string, Map<string, Decimal>>();
  // Percentages are computed within each transaction type: mixing income and
  // spending into one denominator would produce a share of a meaningless whole.
  const totalByType = new Map<TransactionType, Decimal>();

  for (const row of rows) {
    if (!includeRowInCashflow(row.kind, kindsFilter, row.sourceTransactionId)) {
      continue;
    }
    const display = await rowDisplayAmount(row, displayCurrency);
    const signed = categorySignedAmount(display);
    const attributionType = categoryAttributionType(row);
    totalByType.set(
      attributionType,
      (totalByType.get(attributionType) ?? toDecimal(0)).plus(signed),
    );
    if (row.categories.length === 0) {
      const key = `uncategorized:${attributionType}`;
      const current = rootBuckets.get(key) ?? {
        categoryId: null,
        title: "Uncategorized",
        type: attributionType,
        amount: toDecimal(0),
      };
      current.amount = current.amount.plus(signed);
      rootBuckets.set(key, current);
      continue;
    }

    const share = signed.div(row.categories.length);
    for (const link of row.categories) {
      const rootId = resolveRootCategoryId(link.categoryId, byId);
      const root = byId.get(rootId);
      const bucketKey = `${attributionType}:${rootId}`;
      const rootBucket = rootBuckets.get(bucketKey) ?? {
        categoryId: rootId,
        title: root?.title ?? link.category.title,
        type: attributionType,
        amount: toDecimal(0),
      };
      rootBucket.amount = rootBucket.amount.plus(share);
      rootBuckets.set(bucketKey, rootBucket);

      const childId = resolveDirectChildUnderRoot(
        link.categoryId,
        rootId,
        byId,
      );
      if (!childId) {
        continue;
      }
      const children = childBuckets.get(bucketKey) ?? new Map<string, Decimal>();
      children.set(childId, (children.get(childId) ?? toDecimal(0)).plus(share));
      childBuckets.set(bucketKey, children);
    }
  }

  const slices: CategorySlice[] = [];
  for (const [bucketKey, value] of rootBuckets) {
    const typeTotal = totalByType.get(value.type) ?? toDecimal(0);
    const percent = typeTotal.gt(0)
      ? Number(value.amount.div(typeTotal).mul(100).toFixed(2))
      : 0;
    const children: CategorySlice[] = [];
    if (value.categoryId) {
      const childMap = childBuckets.get(bucketKey) ?? new Map();
      for (const [childId, amount] of childMap) {
        const childPercent = value.amount.gt(0)
          ? Number(amount.div(value.amount).mul(100).toFixed(2))
          : 0;
        children.push({
          categoryId: childId,
          title: byId.get(childId)?.title ?? childId,
          type: value.type,
          amount: decimalToString(amount),
          percent: childPercent,
          children: [],
        });
      }
      children.sort((a, b) => toDecimal(b.amount).cmp(toDecimal(a.amount)));
    }
    slices.push({
      categoryId: value.categoryId,
      title: value.title,
      type: value.type,
      amount: decimalToString(value.amount),
      percent,
      children,
    });
  }
  slices.sort((a, b) => toDecimal(b.amount).cmp(toDecimal(a.amount)));
  return slices;
}

export async function buildTimeline(
  rows: TxRow[],
  bucket: TimelineBucket,
  timezone: string,
  start: Date | null,
  end: Date | null,
  displayCurrency: string,
  kindsFilter?: readonly TransactionKind[],
): Promise<TimelinePoint[]> {
  const bucketKeys = resolveBucketKeys(bucket, timezone, start, end, rows);
  const spending = new Map<string, Decimal>();
  const earning = new Map<string, Decimal>();
  for (const key of bucketKeys) {
    spending.set(key, toDecimal(0));
    earning.set(key, toDecimal(0));
  }

  for (const row of rows) {
    if (!includeRowInCashflow(row.kind, kindsFilter, row.sourceTransactionId)) {
      continue;
    }
    const key = formatBucketKey(row.occurredAt, bucket, timezone);
    if (!spending.has(key)) {
      spending.set(key, toDecimal(0));
      earning.set(key, toDecimal(0));
      bucketKeys.push(key);
    }
    const amount = await rowDisplayAmount(row, displayCurrency);
    const attributed = attributeCashflowAmount(row, amount);
    if (attributed.type === TransactionType.Spending) {
      spending.set(
        key,
        (spending.get(key) ?? toDecimal(0)).plus(attributed.amount),
      );
    } else {
      earning.set(
        key,
        (earning.get(key) ?? toDecimal(0)).plus(attributed.amount),
      );
    }
  }

  const points: TimelinePoint[] = [];
  for (const key of bucketKeys) {
    const spend = spending.get(key) ?? toDecimal(0);
    const earn = earning.get(key) ?? toDecimal(0);
    const net = earn.minus(spend);
    points.push({
      bucket: key,
      spending: decimalToString(spend),
      earning: decimalToString(earn),
      net: decimalToString(net),
    });
  }
  return points;
}

function resolveBucketKeys(
  bucket: TimelineBucket,
  timezone: string,
  start: Date | null,
  end: Date | null,
  rows: TxRow[],
): string[] {
  if (!start || !end) {
    if (rows.length === 0) {
      return [];
    }
    const minOccurred = minDate(rows.map((row) => row.occurredAt));
    const maxOccurred = maxDate(rows.map((row) => row.occurredAt));
    const months = eachMonthOfInterval({
      start: minOccurred,
      end: maxOccurred,
    });
    if (months.length > 24) {
      return eachYearOfInterval({
        start: minOccurred,
        end: maxOccurred,
      }).map((date) => format(toZonedTime(date, timezone), "yyyy"));
    }
    return months.map((date) =>
      format(toZonedTime(date, timezone), "yyyy-MM"),
    );
  }

  const rangeEnd = capTimelineEnd(end);

  if (bucket === "hour") {
    return eachHourOfInterval({ start, end: rangeEnd }).map((date) =>
      format(toZonedTime(date, timezone), "yyyy-MM-dd HH:00"),
    );
  }
  if (bucket === "day") {
    return eachDayOfInterval({ start, end: rangeEnd }).map((date) =>
      format(toZonedTime(date, timezone), "yyyy-MM-dd"),
    );
  }
  if (bucket === "month") {
    return eachMonthOfInterval({ start, end: rangeEnd }).map((date) =>
      format(toZonedTime(date, timezone), "yyyy-MM"),
    );
  }
  return eachYearOfInterval({ start, end: rangeEnd }).map((date) =>
    format(toZonedTime(date, timezone), "yyyy"),
  );
}

function capTimelineEnd(end: Date): Date {
  const now = new Date();
  return end.getTime() > now.getTime() ? now : end;
}

function formatBucketKey(
  occurredAt: Date,
  bucket: TimelineBucket,
  timezone: string,
): string {
  const zoned = toZonedTime(occurredAt, timezone);
  if (bucket === "hour") {
    return format(zoned, "yyyy-MM-dd HH:00");
  }
  if (bucket === "day") {
    return format(zoned, "yyyy-MM-dd");
  }
  if (bucket === "month") {
    return format(zoned, "yyyy-MM");
  }
  return format(zoned, "yyyy");
}

export function buildCurrencyBreakdown(rows: TxRow[]) {
  const map = new Map<string, { amount: Decimal; count: number }>();
  for (const row of rows) {
    if (
      isCashflowExcludedKind(row.kind) ||
      Boolean(row.sourceTransactionId)
    ) {
      continue;
    }
    const key = row.inputCurrency.toUpperCase();
    const current = map.get(key) ?? { amount: toDecimal(0), count: 0 };
    current.amount = current.amount.plus(toDecimal(row.originalAmount.toString()));
    current.count += 1;
    map.set(key, current);
  }
  return [...map.entries()]
    .map(([currency, value]) => ({
      currency,
      amount: decimalToString(value.amount),
      count: value.count,
    }))
    .sort((a, b) => toDecimal(b.amount).cmp(toDecimal(a.amount)));
}

export function sortNamedAmountsDesc(items: NamedAmount[]): void {
  items.sort((a, b) => toDecimal(b.amount).cmp(toDecimal(a.amount)));
}

export function groupDebtRowsByCounterparty(rows: TxRow[]): Map<string, TxRow[]> {
  const byParty = new Map<string, TxRow[]>();
  for (const row of rows) {
    if (!isDebtLedgerKind(row.kind)) {
      continue;
    }
    const key = row.counterpartyId ?? "unknown";
    const list = byParty.get(key) ?? [];
    list.push(row);
    byParty.set(key, list);
  }
  return byParty;
}

/** Positive = counterparty owes me; negative = I owe counterparty. */
export async function netDebtBalance(
  partyRows: TxRow[],
  displayCurrency: string,
): Promise<Decimal> {
  let net = toDecimal(0);
  for (const row of partyRows) {
    const sign = debtBalanceDelta(row.kind, row.type);
    if (sign === 0) {
      continue;
    }
    const display = await rowDisplayAmount(row, displayCurrency);
    net = net.plus(display.times(sign));
  }
  return net;
}

export function inBounds(
  value: Date,
  start: Date | null,
  end: Date | null,
): boolean {
  if (start && value < start) {
    return false;
  }
  if (end && value > end) {
    return false;
  }
  return true;
}

export function meanIntervalDays(dates: Date[]): number | null {
  if (dates.length < 2) {
    return null;
  }
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  let total = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    total += sorted[index]!.getTime() - sorted[index - 1]!.getTime();
  }
  const meanMs = total / (sorted.length - 1);
  return Number((meanMs / (24 * 60 * 60 * 1000)).toFixed(2));
}
