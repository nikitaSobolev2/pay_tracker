import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import Decimal from "decimal.js";

import { medianSettleDaysFromEvents } from "@/lib/debt-episodes";
import { AppServiceError } from "@/lib/errors";
import { decimalToString, toDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import { TransactionKind, TransactionType } from "@/types/enums";

import { toCategoryDtos } from "./category-service";
import type {
  CategoryDetailStats,
  DebtDetailStats,
} from "./detail-stats-service.types";
import { convertRubToDisplay } from "./exchange-rate-service";
import type {
  CategorySlice,
  MoneyAmount,
  NamedAmount,
  TimelinePoint,
} from "./stats-service.types";
import { getTransaction, listTransactions } from "./transaction-service";

function moneyOf(amount: Decimal, currency: string): MoneyAmount {
  return { amount: decimalToString(amount), currency };
}

async function toDisplay(
  amountRub: Decimal,
  currency: string,
  fxRateDate: Date,
): Promise<Decimal> {
  const result = await convertRubToDisplay(amountRub, currency, fxRateDate);
  return toDecimal(result.amount);
}

export async function getCategoryDetailStats(input: {
  userId: string;
  categoryId: string;
  displayCurrency: string;
  timezone: string;
}): Promise<CategoryDetailStats> {
  const category = await prisma.userCategory.findFirst({
    where: { id: input.categoryId, userId: input.userId },
    select: {
      id: true,
      title: true,
      type: true,
      parentCategoryId: true,
    },
  });
  if (!category) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Category not found");
  }

  const [dto] = await toCategoryDtos([category]);
  let parentTitle: string | null = null;
  let parentPath: string | null = null;
  if (category.parentCategoryId) {
    const parent = await prisma.userCategory.findFirst({
      where: { id: category.parentCategoryId, userId: input.userId },
      select: {
        id: true,
        title: true,
        type: true,
        parentCategoryId: true,
      },
    });
    if (parent) {
      const [parentDto] = await toCategoryDtos([parent]);
      parentTitle = parentDto?.title ?? null;
      parentPath = parentDto?.path ?? null;
    }
  }

  const end = new Date();
  const start = startOfMonth(subMonths(end, 11));

  const allCats = await prisma.userCategory.findMany({
    where: { userId: input.userId, type: category.type },
    select: {
      id: true,
      title: true,
      type: true,
      parentCategoryId: true,
    },
  });
  const descendants = collectDescendants(allCats, category.id);
  const categoryIds = [category.id, ...descendants];
  const parentDescendants = category.parentCategoryId
    ? [
        category.parentCategoryId,
        ...collectDescendants(allCats, category.parentCategoryId),
      ]
    : [];

  const rows = await prisma.transaction.findMany({
    where: {
      userId: input.userId,
      isDeleted: false,
      type: category.type,
      kind: { not: TransactionKind.Transfer },
      occurredAt: { gte: start, lte: end },
      categories: {
        some: {
          categoryId: {
            in: [...new Set([...categoryIds, ...parentDescendants])],
          },
        },
      },
    },
    include: {
      counterparty: true,
      categories: { include: { category: true } },
    },
    orderBy: { occurredAt: "asc" },
  });

  const inCategory = rows.filter((row) =>
    row.categories.some((link) => categoryIds.includes(link.categoryId)),
  );
  const inParent = category.parentCategoryId
    ? rows.filter((row) =>
        row.categories.some((link) =>
          parentDescendants.includes(link.categoryId),
        ),
      )
    : [];

  const timeline = await buildMonthlyTimeline(
    inCategory,
    input.displayCurrency,
    start,
    end,
    input.timezone,
  );
  const parentTimeline = category.parentCategoryId
    ? await buildMonthlyTimeline(
        inParent,
        input.displayCurrency,
        start,
        end,
        input.timezone,
      )
    : [];

  const siblings = allCats.filter(
    (row) => row.parentCategoryId === category.parentCategoryId,
  );
  const siblingShares: NamedAmount[] = [];
  for (const sibling of siblings) {
    const ids = [sibling.id, ...collectDescendants(allCats, sibling.id)];
    const siblingRows = rows.filter((row) =>
      row.categories.some((link) => ids.includes(link.categoryId)),
    );
    const total = await sumRows(siblingRows, input.displayCurrency);
    if (!total.isZero()) {
      siblingShares.push({
        id: sibling.id,
        name: sibling.title,
        amount: decimalToString(total),
      });
    }
  }
  siblingShares.sort((a, b) => toDecimal(b.amount).cmp(toDecimal(a.amount)));

  const children = allCats.filter((row) => row.parentCategoryId === category.id);
  const childrenBreakdown: NamedAmount[] = [];
  const childrenPieDrafts: Array<{
    child: (typeof children)[number];
    amount: Decimal;
    nested: CategorySlice[];
  }> = [];
  let childrenPieTotal = toDecimal(0);

  for (const child of children) {
    const ids = [child.id, ...collectDescendants(allCats, child.id)];
    const childRows = inCategory.filter((row) =>
      row.categories.some((link) => ids.includes(link.categoryId)),
    );
    const total = await sumRows(childRows, input.displayCurrency);
    if (total.isZero()) {
      continue;
    }
    childrenBreakdown.push({
      id: child.id,
      name: child.title,
      amount: decimalToString(total),
    });

    const grandchildren = allCats.filter(
      (row) => row.parentCategoryId === child.id,
    );
    const nested: CategorySlice[] = [];
    for (const grandchild of grandchildren) {
      const grandchildIds = [
        grandchild.id,
        ...collectDescendants(allCats, grandchild.id),
      ];
      const grandchildRows = inCategory.filter((row) =>
        row.categories.some((link) =>
          grandchildIds.includes(link.categoryId),
        ),
      );
      const grandchildTotal = await sumRows(
        grandchildRows,
        input.displayCurrency,
      );
      if (grandchildTotal.isZero()) {
        continue;
      }
      nested.push({
        categoryId: grandchild.id,
        title: grandchild.title,
        type: category.type,
        amount: decimalToString(grandchildTotal),
        percent: Number(
          grandchildTotal.div(total).mul(100).toFixed(2),
        ),
        children: [],
      });
    }
    nested.sort((a, b) => toDecimal(b.amount).cmp(toDecimal(a.amount)));
    childrenPieDrafts.push({ child, amount: total, nested });
    childrenPieTotal = childrenPieTotal.plus(total);
  }

  childrenBreakdown.sort((a, b) =>
    toDecimal(b.amount).cmp(toDecimal(a.amount)),
  );

  const childrenPie: CategorySlice[] = childrenPieDrafts
    .map(({ child, amount, nested }) => ({
      categoryId: child.id,
      title: child.title,
      type: category.type,
      amount: decimalToString(amount),
      percent: childrenPieTotal.gt(0)
        ? Number(amount.div(childrenPieTotal).mul(100).toFixed(2))
        : 0,
      children: nested,
    }))
    .sort((a, b) => toDecimal(b.amount).cmp(toDecimal(a.amount)));

  const thisMonthStart = startOfMonth(end);
  const lastMonthStart = startOfMonth(subMonths(end, 1));
  const thisMonthRows = inCategory.filter(
    (row) => row.occurredAt >= thisMonthStart,
  );
  const lastMonthRows = inCategory.filter(
    (row) =>
      row.occurredAt >= lastMonthStart && row.occurredAt < thisMonthStart,
  );
  const thisMonthAmt = await sumRows(thisMonthRows, input.displayCurrency);
  const lastMonthAmt = await sumRows(lastMonthRows, input.displayCurrency);
  const momDeltaPercent = lastMonthAmt.isZero()
    ? null
    : Number(
        thisMonthAmt.minus(lastMonthAmt).div(lastMonthAmt).mul(100).toFixed(2),
      );

  const byParty = new Map<string, { name: string; rows: typeof inCategory }>();
  for (const row of inCategory) {
    if (!row.counterparty) {
      continue;
    }
    const bucket = byParty.get(row.counterparty.id) ?? {
      name: row.counterparty.name,
      rows: [],
    };
    bucket.rows.push(row);
    byParty.set(row.counterparty.id, bucket);
  }
  const topCounterparties: NamedAmount[] = [];
  for (const [id, bucket] of byParty) {
    const total = await sumRows(bucket.rows, input.displayCurrency);
    topCounterparties.push({
      id,
      name: bucket.name,
      amount: decimalToString(total),
    });
  }
  topCounterparties.sort((a, b) =>
    toDecimal(b.amount).cmp(toDecimal(a.amount)),
  );

  return {
    categoryId: category.id,
    title: category.title,
    path: dto?.path ?? category.title,
    type: category.type,
    parentCategoryId: category.parentCategoryId,
    parentTitle,
    parentPath,
    currency: input.displayCurrency,
    timeline,
    parentTimeline,
    siblingShares: siblingShares.slice(0, 8),
    childrenBreakdown: childrenBreakdown.slice(0, 8),
    childrenPie,
    thisMonth: moneyOf(thisMonthAmt, input.displayCurrency),
    lastMonth: moneyOf(lastMonthAmt, input.displayCurrency),
    momDeltaPercent,
    topCounterparties: topCounterparties.slice(0, 6),
  };
}

export async function getDebtDetailStats(input: {
  userId: string;
  counterpartyId: string;
  displayCurrency: string;
  timezone: string;
}): Promise<DebtDetailStats> {
  const counterparty = await prisma.userCounterparty.findFirst({
    where: { id: input.counterpartyId, userId: input.userId },
    select: { id: true, name: true },
  });
  if (!counterparty) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Counterparty not found");
  }

  const list = await listTransactions({
    userId: input.userId,
    displayCurrency: input.displayCurrency,
    timezone: input.timezone,
    counterpartyIds: [input.counterpartyId],
    kinds: [TransactionKind.Loan, TransactionKind.Debt],
    page: 1,
    pageSize: 100,
  });

  const rows = await prisma.transaction.findMany({
    where: {
      userId: input.userId,
      isDeleted: false,
      counterpartyId: input.counterpartyId,
      kind: {
        in: [TransactionKind.Loan, TransactionKind.Debt],
      },
    },
    orderBy: { occurredAt: "asc" },
    select: {
      id: true,
      kind: true,
      amount: true,
      originalAmount: true,
      inputCurrency: true,
      fxRateDate: true,
      occurredAt: true,
      title: true,
    },
  });

  let running = toDecimal(0);
  const runningBalance: DebtDetailStats["runningBalance"] = [];
  const settledProgress: DebtDetailStats["settledProgress"] = [];
  for (const row of rows) {
    const display = await toDisplay(
      toDecimal(row.amount.toString()),
      input.displayCurrency,
      row.fxRateDate,
    );
    if (row.kind === TransactionKind.Loan) {
      running = running.plus(display);
    } else {
      running = running.minus(display);
    }
    runningBalance.push({
      date: row.occurredAt.toISOString(),
      balance: decimalToString(running),
    });
    settledProgress.push({
      date: row.occurredAt.toISOString(),
      remaining: decimalToString(running.abs()),
    });
  }

  const monthBuckets = new Map<string, { lend: Decimal; borrow: Decimal }>();
  for (const row of rows) {
    const key = format(toZonedTime(row.occurredAt, input.timezone), "yyyy-MM");
    const bucket = monthBuckets.get(key) ?? {
      lend: toDecimal(0),
      borrow: toDecimal(0),
    };
    const display = await toDisplay(
      toDecimal(row.amount.toString()),
      input.displayCurrency,
      row.fxRateDate,
    );
    if (row.kind === TransactionKind.Loan) {
      bucket.lend = bucket.lend.plus(display);
    } else {
      bucket.borrow = bucket.borrow.plus(display);
    }
    monthBuckets.set(key, bucket);
  }
  const monthlyLendBorrow = [...monthBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, values]) => ({
      bucket,
      lend: decimalToString(values.lend),
      borrow: decimalToString(values.borrow),
    }));

  const eventGapsDays: number[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1]!.occurredAt.getTime();
    const curr = rows[i]!.occurredAt.getTime();
    eventGapsDays.push(
      Number(((curr - prev) / (24 * 60 * 60 * 1000)).toFixed(1)),
    );
  }

  const amountSizes = await Promise.all(
    rows.map(async (row) => {
      const display = await toDisplay(
        toDecimal(row.amount.toString()),
        input.displayCurrency,
        row.fxRateDate,
      );
      return {
        id: row.id,
        label: row.title || format(row.occurredAt, "yyyy-MM-dd"),
        amount: decimalToString(display),
      };
    }),
  );
  amountSizes.sort((a, b) => toDecimal(b.amount).cmp(toDecimal(a.amount)));

  const byCurrency = new Map<string, Decimal>();
  for (const row of rows) {
    const display = await toDisplay(
      toDecimal(row.amount.toString()),
      input.displayCurrency,
      row.fxRateDate,
    );
    byCurrency.set(
      row.inputCurrency,
      (byCurrency.get(row.inputCurrency) ?? toDecimal(0)).plus(display),
    );
  }
  const currencyBreakdown: NamedAmount[] = [...byCurrency.entries()].map(
    ([name, amount]) => ({
      id: name,
      name,
      amount: decimalToString(amount),
    }),
  );

  const net = running;
  const thisMonthStart = startOfMonth(new Date());
  let monthNet = toDecimal(0);
  for (const row of rows.filter((item) => item.occurredAt >= thisMonthStart)) {
    const display = await toDisplay(
      toDecimal(row.amount.toString()),
      input.displayCurrency,
      row.fxRateDate,
    );
    monthNet =
      row.kind === TransactionKind.Loan
        ? monthNet.plus(display)
        : monthNet.minus(display);
  }

  const absNet = net.abs();
  const tone: DebtDetailStats["tone"] = net.isZero()
    ? "settled"
    : net.gt(0)
      ? "owed"
      : "owe";

  return {
    counterpartyId: counterparty.id,
    name: counterparty.name,
    currency: input.displayCurrency,
    tone,
    netAllTime: moneyOf(absNet, input.displayCurrency),
    netThisMonth: moneyOf(
      tone === "owed"
        ? Decimal.max(monthNet, toDecimal(0))
        : Decimal.max(monthNet.neg(), toDecimal(0)),
      input.displayCurrency,
    ),
    averageAmount: moneyOf(
      rows.length > 0 ? absNet.div(rows.length) : toDecimal(0),
      input.displayCurrency,
    ),
    frequencyDays:
      eventGapsDays.length > 0
        ? Number(
            (
              eventGapsDays.reduce((sum, value) => sum + value, 0) /
              eventGapsDays.length
            ).toFixed(1),
          )
        : null,
    medianSettleDays: medianSettleDaysFromEvents(
      rows.flatMap((row) =>
        row.kind === TransactionKind.Loan ||
        row.kind === TransactionKind.Debt
          ? [
              {
                occurredAt: row.occurredAt,
                kind: row.kind,
                amountRub: row.amount.toString(),
              },
            ]
          : [],
      ),
    ),
    eventCount: rows.length,
    runningBalance,
    monthlyLendBorrow,
    eventGapsDays,
    amountSizes: amountSizes.slice(0, 12),
    currencyBreakdown,
    settledProgress,
    transactions: list.items,
  };
}

export async function getTransactionWithCategoryContext(input: {
  userId: string;
  transactionId: string;
  displayCurrency: string;
  timezone: string;
}) {
  const transaction = await getTransaction(
    input.userId,
    input.transactionId,
    input.displayCurrency,
  );
  const primary = transaction.categories[0] ?? null;
  const categoryStats = primary
    ? await getCategoryDetailStats({
        userId: input.userId,
        categoryId: primary.id,
        displayCurrency: input.displayCurrency,
        timezone: input.timezone,
      })
    : null;

  const related = primary
    ? await listTransactions({
        userId: input.userId,
        displayCurrency: input.displayCurrency,
        timezone: input.timezone,
        categoryIds: [primary.id],
        type: transaction.type,
        page: 1,
        pageSize: 20,
      })
    : { items: [], page: 1, pageSize: 20, total: 0 };

  return {
    transaction,
    categoryStats,
    relatedTransactions: related.items.filter(
      (item) => item.id !== transaction.id,
    ),
  };
}

function collectDescendants(
  all: Array<{ id: string; parentCategoryId: string | null }>,
  rootId: string,
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const row of all) {
    if (!row.parentCategoryId) {
      continue;
    }
    const list = childrenByParent.get(row.parentCategoryId) ?? [];
    list.push(row.id);
    childrenByParent.set(row.parentCategoryId, list);
  }
  const result: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const child of childrenByParent.get(current) ?? []) {
      result.push(child);
      queue.push(child);
    }
  }
  return result;
}

async function sumRows(
  rows: Array<{ amount: { toString(): string }; fxRateDate: Date }>,
  currency: string,
): Promise<Decimal> {
  let total = toDecimal(0);
  for (const row of rows) {
    total = total.plus(
      await toDisplay(
        toDecimal(row.amount.toString()),
        currency,
        row.fxRateDate,
      ),
    );
  }
  return total;
}

async function buildMonthlyTimeline(
  rows: Array<{
    type: TransactionType;
    amount: { toString(): string };
    fxRateDate: Date;
    occurredAt: Date;
  }>,
  currency: string,
  start: Date,
  end: Date,
  timezone: string,
): Promise<TimelinePoint[]> {
  const buckets = new Map<string, { earning: Decimal; spending: Decimal }>();
  let cursor = startOfMonth(start);
  while (cursor <= end) {
    buckets.set(format(cursor, "yyyy-MM"), {
      earning: toDecimal(0),
      spending: toDecimal(0),
    });
    cursor = addMonths(cursor, 1);
  }

  for (const row of rows) {
    const key = format(toZonedTime(row.occurredAt, timezone), "yyyy-MM");
    const bucket = buckets.get(key);
    if (!bucket) {
      continue;
    }
    const display = await toDisplay(
      toDecimal(row.amount.toString()),
      currency,
      row.fxRateDate,
    );
    if (row.type === TransactionType.Earning) {
      bucket.earning = bucket.earning.plus(display);
    } else {
      bucket.spending = bucket.spending.plus(display);
    }
  }

  return [...buckets.entries()].map(([bucket, values]) => ({
    bucket,
    earning: decimalToString(values.earning),
    spending: decimalToString(values.spending),
    net: decimalToString(values.earning.minus(values.spending)),
  }));
}
