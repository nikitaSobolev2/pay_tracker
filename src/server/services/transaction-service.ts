import { Prisma } from "@prisma/client";

import {
  getAbsoluteRangeBounds,
  getDateRangeBounds,
  getRollingRangeBounds,
} from "@/lib/dates";
import { AppServiceError } from "@/lib/errors";
import { decimalToString, toDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import {
  SortDirection,
  TransactionKind,
  TransactionSortBy,
  TransactionType,
} from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

import {
  assertCategoriesMatchType,
  toCategoryDtos,
} from "./category-service";
import { findOrCreateCounterparty } from "./counterparty-service";
import {
  convertRubToDisplay,
  resolveRateForCurrency,
} from "./exchange-rate-service";
import type {
  BulkDeleteTransactionsInput,
  ClearTransactionsInput,
  CreateTransactionInput,
  ListTransactionsInput,
  ListTransactionsResult,
  TitleSuggestionsInput,
  UpdateTransactionInput,
} from "./transaction-service.types";

type TransactionRecord = Prisma.TransactionGetPayload<{
  include: {
    counterparty: true;
    categories: { include: { category: true } };
  };
}>;

const DEBT_KINDS: TransactionKind[] = [
  TransactionKind.Loan,
  TransactionKind.Debt,
];

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<TransactionDto> {
  const existing = await findActiveByIdempotencyKey(
    input.userId,
    input.idempotencyKey,
  );
  if (existing) {
    return mapTransactionDto(existing, input.displayCurrency);
  }

  const validated = await validateTransactionWrite(input);
  const money = await resolveCanonicalMoney(
    validated.inputCurrency,
    validated.originalAmount,
    validated.occurredAt,
  );

  try {
    const created = await prisma.transaction.create({
      data: {
        userId: input.userId,
        type: validated.type,
        amount: money.amountRub.toFixed(4),
        inputCurrency: validated.inputCurrency,
        originalAmount: money.originalAmount.toFixed(4),
        rateToRub: money.rateToRub.toFixed(8),
        fxRateDate: money.fxRateDate,
        title: validated.title,
        occurredAt: validated.occurredAt,
        kind: validated.kind,
        counterpartyId: validated.counterpartyId,
        idempotencyKey: input.idempotencyKey,
        categories: {
          create: validated.categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
      include: transactionInclude,
    });
    return mapTransactionDto(created, input.displayCurrency);
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await findActiveByIdempotencyKey(
        input.userId,
        input.idempotencyKey,
      );
      if (raced) {
        return mapTransactionDto(raced, input.displayCurrency);
      }
    }
    throw error;
  }
}

export async function listTransactions(
  input: ListTransactionsInput,
): Promise<ListTransactionsResult> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 50));
  const where = buildTransactionWhere(input);

  const orderBy = resolveTransactionOrderBy(input.sortBy, input.sortDir);

  if (input.sortBy === TransactionSortBy.Categories) {
    const ordered = await listOrderedByCategoryTitle({
      where,
      sortDir: input.sortDir ?? SortDirection.Asc,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const [total, rows] = await Promise.all([
      prisma.transaction.count({ where }),
      ordered.length === 0
        ? Promise.resolve([] as TransactionRecord[])
        : prisma.transaction.findMany({
            where: { ...where, id: { in: ordered } },
            include: transactionInclude,
          }),
    ]);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = await Promise.all(
      ordered
        .map((id) => byId.get(id))
        .filter((row): row is TransactionRecord => row != null)
        .map((row) => mapTransactionDto(row, input.displayCurrency)),
    );
    return { items, page, pageSize, total };
  }

  const [total, rows] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: transactionInclude,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = await Promise.all(
    rows.map((row) => mapTransactionDto(row, input.displayCurrency)),
  );
  return { items, page, pageSize, total };
}

export async function suggestTransactionsByTitle(
  input: TitleSuggestionsInput,
): Promise<TransactionDto[]> {
  const query = input.query.trim();
  if (!query) {
    return [];
  }
  const limit = Math.min(50, Math.max(1, input.limit ?? 20));
  const rows = await prisma.transaction.findMany({
    where: {
      userId: input.userId,
      isDeleted: false,
      title: { contains: query, mode: "insensitive" },
      ...(input.type ? { type: input.type } : {}),
    },
    include: transactionInclude,
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: limit * 3,
  });
  const ranked = rankTitleMatches(rows, query).slice(0, limit);
  return Promise.all(
    ranked.map((row) => mapTransactionDto(row, input.displayCurrency)),
  );
}

export async function getTransaction(
  userId: string,
  transactionId: string,
  displayCurrency: string,
): Promise<TransactionDto> {
  const row = await prisma.transaction.findFirst({
    where: { id: transactionId, userId, isDeleted: false },
    include: transactionInclude,
  });
  if (!row) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Transaction not found");
  }
  return mapTransactionDto(row, displayCurrency);
}

export async function updateTransaction(
  input: UpdateTransactionInput,
): Promise<TransactionDto> {
  const existing = await prisma.transaction.findFirst({
    where: {
      id: input.transactionId,
      userId: input.userId,
      isDeleted: false,
    },
    include: transactionInclude,
  });
  if (!existing) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Transaction not found");
  }

  const nextType = input.type ?? existing.type;
  const nextOriginalAmount =
    input.originalAmount ?? existing.originalAmount.toString();
  const nextInputCurrency = (
    input.inputCurrency ?? existing.inputCurrency
  ).toUpperCase();
  const nextOccurredAt = input.occurredAt ?? existing.occurredAt;
  const nextTitle =
    input.title === undefined ? existing.title : input.title?.trim() || null;
  const nextKind = input.kind === undefined ? existing.kind : input.kind;
  const nextCategoryIds =
    input.categoryIds ?? existing.categories.map((link) => link.categoryId);

  let counterpartyName =
    input.counterpartyName === undefined
      ? (existing.counterparty?.name ?? null)
      : input.counterpartyName;

  if (!requiresCounterparty(nextKind)) {
    counterpartyName = null;
  }

  const validated = await validateTransactionWrite({
    userId: input.userId,
    type: nextType,
    originalAmount: nextOriginalAmount,
    inputCurrency: nextInputCurrency,
    title: nextTitle,
    occurredAt: nextOccurredAt,
    kind: nextKind,
    counterpartyName,
    categoryIds: nextCategoryIds,
  });

  const money = await resolveCanonicalMoney(
    validated.inputCurrency,
    validated.originalAmount,
    validated.occurredAt,
  );

  const updated = await prisma.$transaction(async (tx) => {
    await tx.transactionCategory.deleteMany({
      where: { transactionId: existing.id },
    });
    return tx.transaction.update({
      where: { id: existing.id },
      data: {
        type: validated.type,
        amount: money.amountRub.toFixed(4),
        inputCurrency: validated.inputCurrency,
        originalAmount: money.originalAmount.toFixed(4),
        rateToRub: money.rateToRub.toFixed(8),
        fxRateDate: money.fxRateDate,
        title: validated.title,
        occurredAt: validated.occurredAt,
        kind: validated.kind,
        counterpartyId: validated.counterpartyId,
        categories: {
          create: validated.categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
      include: transactionInclude,
    });
  });

  return mapTransactionDto(updated, input.displayCurrency);
}

export async function deleteTransaction(
  userId: string,
  transactionId: string,
): Promise<void> {
  const result = await prisma.transaction.updateMany({
    where: { id: transactionId, userId, isDeleted: false },
    data: {
      isDeleted: true,
      idempotencyKey: deletedIdempotencyKey(transactionId),
    },
  });
  if (result.count === 0) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Transaction not found");
  }
}

export async function restoreTransaction(
  userId: string,
  transactionId: string,
): Promise<void> {
  const result = await prisma.transaction.updateMany({
    where: { id: transactionId, userId, isDeleted: true },
    data: { isDeleted: false },
  });
  if (result.count === 0) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Transaction not found");
  }
}

export async function bulkDeleteTransactions(
  input: BulkDeleteTransactionsInput,
): Promise<{ deletedCount: number }> {
  const ids = [...new Set(input.ids)];
  if (ids.length === 0) {
    return { deletedCount: 0 };
  }
  const result = await prisma.$transaction(
    ids.map((id) =>
      prisma.transaction.updateMany({
        where: {
          userId: input.userId,
          id,
          isDeleted: false,
        },
        data: {
          isDeleted: true,
          idempotencyKey: deletedIdempotencyKey(id),
        },
      }),
    ),
  );
  return {
    deletedCount: result.reduce((sum, item) => sum + item.count, 0),
  };
}

const CLEAR_TRANSACTIONS_CHUNK_SIZE = 100;

export async function clearTransactions(
  input: ClearTransactionsInput,
): Promise<{ deletedCount: number }> {
  const hasRange = Boolean(input.startDate && input.endDate);
  if ((input.startDate && !input.endDate) || (!input.startDate && input.endDate)) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Both startDate and endDate are required for a date range",
    );
  }

  const bounds = hasRange
    ? getAbsoluteRangeBounds(input.startDate!, input.endDate!, input.timezone)
    : { start: null, end: null };

  const rows = await prisma.transaction.findMany({
    where: {
      userId: input.userId,
      isDeleted: false,
      ...(bounds.start || bounds.end
        ? {
            occurredAt: {
              ...(bounds.start ? { gte: bounds.start } : {}),
              ...(bounds.end ? { lte: bounds.end } : {}),
            },
          }
        : {}),
    },
    select: { id: true },
  });

  if (rows.length === 0) {
    return { deletedCount: 0 };
  }

  let deletedCount = 0;
  for (let index = 0; index < rows.length; index += CLEAR_TRANSACTIONS_CHUNK_SIZE) {
    const chunk = rows.slice(index, index + CLEAR_TRANSACTIONS_CHUNK_SIZE);
    const result = await prisma.$transaction(
      chunk.map((row) =>
        prisma.transaction.updateMany({
          where: {
            userId: input.userId,
            id: row.id,
            isDeleted: false,
          },
          data: {
            isDeleted: true,
            idempotencyKey: deletedIdempotencyKey(row.id),
          },
        }),
      ),
    );
    deletedCount += result.reduce((sum, item) => sum + item.count, 0);
  }

  return { deletedCount };
}

export function resolveListDateBounds(
  input: Pick<
    ListTransactionsInput,
    | "timezone"
    | "dateRangeType"
    | "rollingUnit"
    | "rollingN"
    | "startDate"
    | "endDate"
  >,
): { start: Date | null; end: Date | null } {
  if (input.startDate && input.endDate) {
    return getAbsoluteRangeBounds(
      input.startDate,
      input.endDate,
      input.timezone,
    );
  }
  if (input.rollingUnit && input.rollingN && input.rollingN > 0) {
    return getRollingRangeBounds(
      input.rollingUnit,
      input.rollingN,
      input.timezone,
    );
  }
  if (input.dateRangeType) {
    return getDateRangeBounds(input.dateRangeType, input.timezone);
  }
  return { start: null, end: null };
}

export function buildTransactionWhere(
  input: Pick<
    ListTransactionsInput,
    | "userId"
    | "timezone"
    | "dateRangeType"
    | "rollingUnit"
    | "rollingN"
    | "startDate"
    | "endDate"
    | "type"
    | "kinds"
    | "categoryIds"
    | "counterpartyIds"
    | "hideUncategorized"
  >,
): Prisma.TransactionWhereInput {
  const bounds = resolveListDateBounds(input);
  const categoryFilter = resolveCategoryWhere(input);

  return {
    userId: input.userId,
    isDeleted: false,
    ...(input.type ? { type: input.type } : {}),
    ...(input.kinds && input.kinds.length > 0
      ? { kind: { in: input.kinds } }
      : {}),
    ...(input.counterpartyIds && input.counterpartyIds.length > 0
      ? { counterpartyId: { in: input.counterpartyIds } }
      : {}),
    ...categoryFilter,
    ...(bounds.start || bounds.end
      ? {
          occurredAt: {
            ...(bounds.start ? { gte: bounds.start } : {}),
            ...(bounds.end ? { lte: bounds.end } : {}),
          },
        }
      : {}),
  };
}

function resolveCategoryWhere(
  input: Pick<ListTransactionsInput, "categoryIds" | "hideUncategorized">,
): Pick<Prisma.TransactionWhereInput, "categories"> | object {
  if (input.categoryIds && input.categoryIds.length > 0) {
    return {
      categories: {
        some: { categoryId: { in: input.categoryIds } },
      },
    };
  }
  if (input.hideUncategorized) {
    return {
      categories: {
        some: {},
      },
    };
  }
  return {};
}

async function validateTransactionWrite(input: {
  userId: string;
  type: TransactionType;
  originalAmount: string;
  inputCurrency: string;
  title?: string | null;
  occurredAt: Date;
  kind?: TransactionKind;
  counterpartyName?: string | null;
  categoryIds?: string[];
}): Promise<{
  type: TransactionType;
  originalAmount: string;
  inputCurrency: string;
  title: string | null;
  occurredAt: Date;
  kind: TransactionKind;
  counterpartyId: string | null;
  categoryIds: string[];
}> {
  const amount = toDecimal(input.originalAmount);
  if (!amount.isFinite() || amount.lte(0)) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Amount must be a positive number",
    );
  }

  const kind = input.kind ?? TransactionKind.Default;
  validateKindForType(input.type, kind);

  const counterpartyName = input.counterpartyName?.trim() || null;
  if (!requiresCounterparty(kind) && counterpartyName) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Counterparty is only allowed for loan or debt",
    );
  }
  if (requiresCounterparty(kind) && !counterpartyName) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Counterparty is required for loan or debt",
    );
  }

  const categoryIds = [...new Set(input.categoryIds ?? [])];
  const categoryType =
    kind === TransactionKind.Refund
      ? TransactionType.Spending
      : input.type;
  await assertCategoriesMatchType(input.userId, categoryIds, categoryType);

  const counterpartyId = counterpartyName
    ? (
        await findOrCreateCounterparty({
          userId: input.userId,
          name: counterpartyName,
        })
      ).id
    : null;

  return {
    type: input.type,
    originalAmount: amount.toFixed(4),
    inputCurrency: input.inputCurrency.toUpperCase(),
    title: input.title?.trim() || null,
    occurredAt: input.occurredAt,
    kind,
    counterpartyId,
    categoryIds,
  };
}

function requiresCounterparty(kind: TransactionKind): boolean {
  return DEBT_KINDS.includes(kind);
}

function validateKindForType(
  type: TransactionType,
  kind: TransactionKind,
): void {
  if (kind === TransactionKind.Default) {
    return;
  }
  if (
    type === TransactionType.Spending &&
    (kind === TransactionKind.Loan || kind === TransactionKind.Transfer)
  ) {
    return;
  }
  if (
    type === TransactionType.Earning &&
    (kind === TransactionKind.Debt || kind === TransactionKind.Refund)
  ) {
    return;
  }
  if (type === TransactionType.Spending) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Spending transactions may only use DEFAULT, LOAN, or TRANSFER kind",
    );
  }
  throw new AppServiceError(
    ApiErrorCode.Validation,
    "Earning transactions may only use DEFAULT, DEBT, or REFUND kind",
  );
}

function rankTitleMatches(
  rows: TransactionRecord[],
  query: string,
): TransactionRecord[] {
  const normalizedQuery = query.trim().toLowerCase();
  return [...rows].sort((left, right) => {
    const leftScore = titleMatchScore(left.title, normalizedQuery);
    const rightScore = titleMatchScore(right.title, normalizedQuery);
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    return right.occurredAt.getTime() - left.occurredAt.getTime();
  });
}

function titleMatchScore(title: string | null, query: string): number {
  if (!title) {
    return 0;
  }
  const normalized = title.toLowerCase();
  if (normalized === query) {
    return 1000;
  }
  if (normalized.startsWith(query)) {
    return 500 + Math.min(query.length, 100);
  }
  const index = normalized.indexOf(query);
  if (index >= 0) {
    return 200 - index;
  }
  return 1;
}

async function resolveCanonicalMoney(
  inputCurrency: string,
  originalAmount: string,
  occurredAt: Date,
) {
  const original = toDecimal(originalAmount);
  const rate = await resolveRateForCurrency(inputCurrency, occurredAt);
  const amountRub = original.mul(rate.rateToRub);
  return {
    originalAmount: original,
    amountRub,
    rateToRub: rate.rateToRub,
    fxRateDate: rate.rateDate,
  };
}

async function mapTransactionDto(
  row: TransactionRecord,
  displayCurrency: string,
): Promise<TransactionDto> {
  const display = await convertRubToDisplay(
    row.amount.toString(),
    displayCurrency,
    row.fxRateDate,
  );
  const categories = await toCategoryDtos(
    row.categories.map((link) => ({
      id: link.category.id,
      title: link.category.title,
      type: link.category.type,
      parentCategoryId: link.category.parentCategoryId,
      keywords: link.category.keywords,
    })),
  );
  return {
    id: row.id,
    type: row.type,
    amount: decimalToString(toDecimal(row.amount.toString())),
    inputCurrency: row.inputCurrency,
    originalAmount: decimalToString(toDecimal(row.originalAmount.toString())),
    rateToRub: toDecimal(row.rateToRub.toString()).toFixed(8),
    fxRateDate: row.fxRateDate.toISOString().slice(0, 10),
    displayAmount: display.amount,
    displayCurrency: display.currency,
    title: row.title,
    occurredAt: row.occurredAt.toISOString(),
    kind: row.kind,
    counterpartyId: row.counterpartyId,
    counterpartyName: row.counterparty?.name ?? null,
    categories,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const transactionInclude = {
  counterparty: true,
  categories: { include: { category: true } },
} satisfies Prisma.TransactionInclude;

async function findActiveByIdempotencyKey(
  userId: string,
  idempotencyKey: string,
): Promise<TransactionRecord | null> {
  return prisma.transaction.findFirst({
    where: { userId, idempotencyKey, isDeleted: false },
    include: transactionInclude,
  });
}

function deletedIdempotencyKey(transactionId: string): string {
  return `deleted:${transactionId}`;
}

function resolveTransactionOrderBy(
  sortBy?: TransactionSortBy,
  sortDir?: SortDirection,
): Prisma.TransactionOrderByWithRelationInput[] {
  const direction = sortDir ?? SortDirection.Desc;
  if (sortBy === TransactionSortBy.Title) {
    return [{ title: direction }, { occurredAt: "desc" }];
  }
  if (sortBy === TransactionSortBy.Amount) {
    return [{ amount: direction }, { occurredAt: "desc" }];
  }
  if (sortBy === TransactionSortBy.Date) {
    return [{ occurredAt: direction }, { createdAt: direction }];
  }
  return [{ occurredAt: "desc" }, { createdAt: "desc" }];
}

async function listOrderedByCategoryTitle(input: {
  where: Prisma.TransactionWhereInput;
  sortDir: SortDirection;
  skip: number;
  take: number;
}): Promise<string[]> {
  const matching = await prisma.transaction.findMany({
    where: input.where,
    select: {
      id: true,
      occurredAt: true,
      categories: {
        select: { category: { select: { title: true } } },
      },
    },
  });
  const direction = input.sortDir === SortDirection.Asc ? 1 : -1;
  matching.sort((left, right) => {
    const leftTitle = earliestCategoryTitle(left.categories);
    const rightTitle = earliestCategoryTitle(right.categories);
    if (leftTitle === rightTitle) {
      return right.occurredAt.getTime() - left.occurredAt.getTime();
    }
    if (leftTitle == null) {
      return 1;
    }
    if (rightTitle == null) {
      return -1;
    }
    return leftTitle.localeCompare(rightTitle) * direction;
  });
  return matching.slice(input.skip, input.skip + input.take).map((row) => row.id);
}

function earliestCategoryTitle(
  categories: Array<{ category: { title: string } }>,
): string | null {
  if (categories.length === 0) {
    return null;
  }
  return [...categories]
    .map((link) => link.category.title)
    .sort((left, right) => left.localeCompare(right))[0] ?? null;
}
