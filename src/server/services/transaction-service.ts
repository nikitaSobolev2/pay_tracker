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
  TransactionDebtRole,
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
  CreateTransactionInput,
  ListTransactionsInput,
  ListTransactionsResult,
  UpdateTransactionInput,
} from "./transaction-service.types";

type TransactionRecord = Prisma.TransactionGetPayload<{
  include: {
    counterparty: true;
    categories: { include: { category: true } };
  };
}>;

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<TransactionDto> {
  const existing = await prisma.transaction.findUnique({
    where: {
      userId_idempotencyKey: {
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    include: transactionInclude,
  });
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
        debtRole: validated.debtRole,
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
      const raced = await prisma.transaction.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: transactionInclude,
      });
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

  const [total, rows] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: transactionInclude,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = await Promise.all(
    rows.map((row) => mapTransactionDto(row, input.displayCurrency)),
  );
  return { items, page, pageSize, total };
}

export async function getTransaction(
  userId: string,
  transactionId: string,
  displayCurrency: string,
): Promise<TransactionDto> {
  const row = await prisma.transaction.findFirst({
    where: { id: transactionId, userId },
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
    where: { id: input.transactionId, userId: input.userId },
    include: transactionInclude,
  });
  if (!existing) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Transaction not found");
  }

  const nextType = input.type ?? existing.type;
  const nextOriginalAmount =
    input.originalAmount ?? existing.originalAmount.toString();
  const nextInputCurrency =
    (input.inputCurrency ?? existing.inputCurrency).toUpperCase();
  const nextOccurredAt = input.occurredAt ?? existing.occurredAt;
  const nextTitle =
    input.title === undefined ? existing.title : input.title?.trim() || null;
  const nextDebtRole =
    input.debtRole === undefined ? existing.debtRole : input.debtRole;
  const nextCategoryIds =
    input.categoryIds ??
    existing.categories.map((link) => link.categoryId);

  let counterpartyName =
    input.counterpartyName === undefined
      ? existing.counterparty?.name ?? null
      : input.counterpartyName;

  if (nextDebtRole == null) {
    counterpartyName = null;
  }

  const validated = await validateTransactionWrite({
    userId: input.userId,
    type: nextType,
    originalAmount: nextOriginalAmount,
    inputCurrency: nextInputCurrency,
    title: nextTitle,
    occurredAt: nextOccurredAt,
    debtRole: nextDebtRole,
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
        debtRole: validated.debtRole,
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
  const result = await prisma.transaction.deleteMany({
    where: { id: transactionId, userId },
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
  const result = await prisma.transaction.deleteMany({
    where: {
      userId: input.userId,
      id: { in: ids },
    },
  });
  return { deletedCount: result.count };
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
    | "debtRoles"
    | "categoryIds"
    | "counterpartyIds"
    | "hideUncategorized"
  >,
): Prisma.TransactionWhereInput {
  const bounds = resolveListDateBounds(input);
  const categoryFilter = resolveCategoryWhere(input);

  return {
    userId: input.userId,
    ...(input.type ? { type: input.type } : {}),
    ...(input.debtRoles && input.debtRoles.length > 0
      ? { debtRole: { in: input.debtRoles } }
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
  debtRole?: TransactionDebtRole | null;
  counterpartyName?: string | null;
  categoryIds?: string[];
}): Promise<{
  type: TransactionType;
  originalAmount: string;
  inputCurrency: string;
  title: string | null;
  occurredAt: Date;
  debtRole: TransactionDebtRole | null;
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

  const debtRole = input.debtRole ?? null;
  validateDebtRoleForType(input.type, debtRole);

  const counterpartyName = input.counterpartyName?.trim() || null;
  if (debtRole == null && counterpartyName) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Counterparty requires a debt role",
    );
  }
  if (debtRole != null && !counterpartyName) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Counterparty is required when debt role is set",
    );
  }

  const categoryIds = [...new Set(input.categoryIds ?? [])];
  await assertCategoriesMatchType(input.userId, categoryIds, input.type);

  const counterpartyId = counterpartyName
    ? (await findOrCreateCounterparty({
        userId: input.userId,
        name: counterpartyName,
      })).id
    : null;

  return {
    type: input.type,
    originalAmount: amount.toFixed(4),
    inputCurrency: input.inputCurrency.toUpperCase(),
    title: input.title?.trim() || null,
    occurredAt: input.occurredAt,
    debtRole,
    counterpartyId,
    categoryIds,
  };
}

function validateDebtRoleForType(
  type: TransactionType,
  debtRole: TransactionDebtRole | null,
): void {
  if (debtRole == null) {
    return;
  }
  if (type === TransactionType.Spending && debtRole !== TransactionDebtRole.Lend) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Spending transactions may only use LEND debt role",
    );
  }
  if (type === TransactionType.Earning && debtRole !== TransactionDebtRole.Borrow) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Earning transactions may only use BORROW debt role",
    );
  }
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
    debtRole: row.debtRole,
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
