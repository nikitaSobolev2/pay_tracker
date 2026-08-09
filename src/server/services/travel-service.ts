import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";

import { AppServiceError } from "@/lib/errors";
import { decimalToString, toDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  countTravelDays,
  resolveTravelPhase,
} from "@/lib/travel-phase";
import { ApiErrorCode } from "@/types/api";
import {
  TravelPhase,
  TravelPlannedCategory,
  TransactionType,
} from "@/types/enums";

import { convertRubToDisplay } from "./exchange-rate-service";
import type {
  CreatePlannedSpendingInput,
  CreateTravelInput,
  TravelAiReportDto,
  TravelCategoryBudgetDto,
  TravelDetailDto,
  TravelListItemDto,
  TravelPlannedSpendingDto,
  TravelSuggestItemDto,
  TravelSummaryDto,
  UpdatePlannedSpendingInput,
  UpdateTravelInput,
  UpsertCategoryBudgetInput,
} from "./travel-service.types";

const FIXED_CATEGORIES: readonly TravelPlannedCategory[] = [
  TravelPlannedCategory.Housing,
  TravelPlannedCategory.TravelExpenses,
];

const EMPTY_BY_CATEGORY = (): Record<TravelPlannedCategory, string> => ({
  [TravelPlannedCategory.FoodDrinks]: "0",
  [TravelPlannedCategory.TravelExpenses]: "0",
  [TravelPlannedCategory.Housing]: "0",
  [TravelPlannedCategory.Souvenirs]: "0",
  [TravelPlannedCategory.Other]: "0",
});

export async function listTravels(
  userId: string,
): Promise<TravelListItemDto[]> {
  const travels = await prisma.travel.findMany({
    where: { userId },
    orderBy: { startsAt: "desc" },
    include: {
      plannedSpendings: { select: { amount: true, category: true } },
      categoryBudgets: { select: { amount: true, category: true } },
      transactions: {
        where: { isDeleted: false, type: TransactionType.Spending },
        select: { amount: true, rateToRub: true, inputCurrency: true, originalAmount: true, fxRateDate: true },
      },
    },
  });

  return Promise.all(
    travels.map(async (travel) => {
      const plannedTotal = computePlannedTotal(
        travel.plannedSpendings.map((row) => ({
          category: row.category,
          amount: row.amount.toString(),
        })),
        travel.categoryBudgets.map((row) => ({
          category: row.category,
          amount: row.amount.toString(),
        })),
      );
      const actualTotal = await sumActualInCurrency(
        travel.transactions,
        travel.currency,
      );
      return toListItem(travel, plannedTotal, actualTotal);
    }),
  );
}

export async function getTravelDetail(
  userId: string,
  travelId: string,
): Promise<TravelDetailDto> {
  const travel = await prisma.travel.findFirst({
    where: { id: travelId, userId },
    include: {
      plannedSpendings: { orderBy: { createdAt: "asc" } },
      categoryBudgets: { orderBy: { category: "asc" } },
      aiReport: true,
      transactions: {
        where: { isDeleted: false, type: TransactionType.Spending },
        select: {
          amount: true,
          originalAmount: true,
          inputCurrency: true,
          rateToRub: true,
          fxRateDate: true,
        },
      },
    },
  });
  if (!travel) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Travel not found");
  }

  const plannedSpendings = travel.plannedSpendings.map(mapPlannedSpending);
  const categoryBudgets = travel.categoryBudgets.map(mapCategoryBudget);
  const summary = await buildSummary(travel, plannedSpendings, categoryBudgets);
  return {
    ...toListItem(travel, summary.plannedTotal, summary.actualTotal),
    placeCountry: travel.placeCountry,
    placeCity: travel.placeCity,
    plannedSpendings,
    categoryBudgets,
    summary,
    aiReport: travel.aiReport ? mapAiReport(travel.aiReport) : null,
  };
}

export async function createTravel(input: CreateTravelInput): Promise<string> {
  assertDateRange(input.startsAt, input.endsAt);
  const travel = await prisma.$transaction(async (tx) => {
    const created = await tx.travel.create({
      data: {
        userId: input.userId,
        title: input.title.trim(),
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        imageUrl: emptyToNull(input.imageUrl),
        placeCountry: emptyToNull(input.placeCountry),
        placeCity: emptyToNull(input.placeCity),
        placeLabel: emptyToNull(input.placeLabel),
        currency: input.currency.toUpperCase(),
        maxSpendingGoal: parseOptionalMoney(input.maxSpendingGoal),
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        phaseOverride: true,
      },
    });
    await enforceSingleInProgress(tx, input.userId, created);
    return created;
  });
  return travel.id;
}

export async function updateTravel(input: UpdateTravelInput): Promise<void> {
  const existing = await requireOwnedTravel(input.userId, input.travelId);
  const startsAt = input.startsAt ?? existing.startsAt;
  const endsAt = input.endsAt ?? existing.endsAt;
  assertDateRange(startsAt, endsAt);

  let phaseOverride = existing.phaseOverride;
  if (input.clearPhaseOverride) {
    phaseOverride = null;
  } else if (input.phaseOverride !== undefined) {
    phaseOverride = input.phaseOverride;
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.travel.update({
      where: { id: input.travelId },
      data: {
        title: input.title?.trim(),
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        imageUrl:
          input.imageUrl === undefined ? undefined : emptyToNull(input.imageUrl),
        placeCountry:
          input.placeCountry === undefined
            ? undefined
            : emptyToNull(input.placeCountry),
        placeCity:
          input.placeCity === undefined
            ? undefined
            : emptyToNull(input.placeCity),
        placeLabel:
          input.placeLabel === undefined
            ? undefined
            : emptyToNull(input.placeLabel),
        maxSpendingGoal:
          input.maxSpendingGoal === undefined
            ? undefined
            : parseOptionalMoney(input.maxSpendingGoal),
        phaseOverride,
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        phaseOverride: true,
      },
    });
    await enforceSingleInProgress(tx, input.userId, updated);
  });
}

export async function deleteTravel(
  userId: string,
  travelId: string,
): Promise<void> {
  await requireOwnedTravel(userId, travelId);
  await prisma.travel.delete({ where: { id: travelId } });
}

/** Returns the single in-progress travel, if any. */
export async function getActiveTravel(
  userId: string,
): Promise<TravelListItemDto | null> {
  const travels = await listTravels(userId);
  return travels.find((travel) => travel.phase === TravelPhase.InProgress) ?? null;
}

export async function suggestTravels(input: {
  readonly userId: string;
  readonly query: string;
  readonly limit?: number;
}): Promise<TravelSuggestItemDto[]> {
  const query = input.query.trim();
  const limit = Math.min(30, Math.max(1, input.limit ?? 12));
  const travels = await prisma.travel.findMany({
    where: {
      userId: input.userId,
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { placeLabel: { contains: query, mode: "insensitive" } },
              { placeCity: { contains: query, mode: "insensitive" } },
              { placeCountry: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { startsAt: "desc" },
    take: limit,
  });
  return travels.map((travel) => ({
    id: travel.id,
    title: travel.title,
    startsAt: travel.startsAt.toISOString(),
    endsAt: travel.endsAt.toISOString(),
    placeLabel: travel.placeLabel,
    imageUrl: travel.imageUrl,
    phase: resolveTravelPhase(travel),
    currency: travel.currency,
  }));
}

export async function createPlannedSpending(
  input: CreatePlannedSpendingInput,
): Promise<TravelPlannedSpendingDto> {
  await requireOwnedTravel(input.userId, input.travelId);
  await assertCategoryUnlocked(input.travelId, input.category);
  const amount = parsePositiveMoney(input.amount);
  const created = await prisma.travelPlannedSpending.create({
    data: {
      travelId: input.travelId,
      title: input.title.trim(),
      category: input.category,
      amount: amount.toFixed(4),
      note: emptyToNull(input.note),
    },
  });
  return mapPlannedSpending(created);
}

export async function updatePlannedSpending(
  input: UpdatePlannedSpendingInput,
): Promise<TravelPlannedSpendingDto> {
  await requireOwnedTravel(input.userId, input.travelId);
  const existing = await prisma.travelPlannedSpending.findFirst({
    where: { id: input.spendingId, travelId: input.travelId },
  });
  if (!existing) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Planned spending not found");
  }
  await assertCategoryUnlocked(input.travelId, existing.category);
  if (input.category && input.category !== existing.category) {
    await assertCategoryUnlocked(input.travelId, input.category);
  }
  const updated = await prisma.travelPlannedSpending.update({
    where: { id: existing.id },
    data: {
      title: input.title?.trim(),
      category: input.category,
      amount:
        input.amount === undefined
          ? undefined
          : parsePositiveMoney(input.amount).toFixed(4),
      note: input.note === undefined ? undefined : emptyToNull(input.note),
    },
  });
  return mapPlannedSpending(updated);
}

/** Set lump category total, or pass null amount to clear and unlock line items. */
export async function upsertCategoryBudget(
  input: UpsertCategoryBudgetInput,
): Promise<TravelCategoryBudgetDto | null> {
  await requireOwnedTravel(input.userId, input.travelId);
  if (input.amount == null || input.amount.trim() === "") {
    await prisma.travelCategoryBudget.deleteMany({
      where: { travelId: input.travelId, category: input.category },
    });
    return null;
  }
  const amount = parseNonNegativeMoney(input.amount);
  const row = await prisma.travelCategoryBudget.upsert({
    where: {
      travelId_category: {
        travelId: input.travelId,
        category: input.category,
      },
    },
    create: {
      travelId: input.travelId,
      category: input.category,
      amount: amount.toFixed(4),
    },
    update: { amount: amount.toFixed(4) },
  });
  return mapCategoryBudget(row);
}

export async function deletePlannedSpending(input: {
  readonly userId: string;
  readonly travelId: string;
  readonly spendingId: string;
}): Promise<void> {
  await requireOwnedTravel(input.userId, input.travelId);
  const result = await prisma.travelPlannedSpending.deleteMany({
    where: { id: input.spendingId, travelId: input.travelId },
  });
  if (result.count === 0) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Planned spending not found");
  }
}

export async function assertTravelOwnedByUser(
  userId: string,
  travelId: string,
): Promise<void> {
  await requireOwnedTravel(userId, travelId);
}

async function enforceSingleInProgress(
  tx: Prisma.TransactionClient,
  userId: string,
  current: {
    readonly id: string;
    readonly startsAt: Date;
    readonly endsAt: Date;
    readonly phaseOverride: TravelPhase | null;
  },
): Promise<void> {
  const currentPhase = resolveTravelPhase(current);
  if (currentPhase !== TravelPhase.InProgress) {
    return;
  }

  const others = await tx.travel.findMany({
    where: { userId, id: { not: current.id } },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      phaseOverride: true,
    },
  });

  const conflicting = others.filter(
    (travel) => resolveTravelPhase(travel) === TravelPhase.InProgress,
  );
  if (conflicting.length === 0) {
    return;
  }

  await tx.travel.updateMany({
    where: { id: { in: conflicting.map((travel) => travel.id) } },
    data: { phaseOverride: TravelPhase.Finished },
  });
}

async function requireOwnedTravel(userId: string, travelId: string) {
  const travel = await prisma.travel.findFirst({
    where: { id: travelId, userId },
  });
  if (!travel) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Travel not found");
  }
  return travel;
}

async function buildSummary(
  travel: {
    readonly startsAt: Date;
    readonly endsAt: Date;
    readonly currency: string;
    readonly maxSpendingGoal: Prisma.Decimal | null;
    readonly transactions: ReadonlyArray<{
      readonly amount: Prisma.Decimal;
      readonly originalAmount: Prisma.Decimal;
      readonly inputCurrency: string;
      readonly rateToRub: Prisma.Decimal;
      readonly fxRateDate: Date;
    }>;
  },
  plannedSpendings: readonly TravelPlannedSpendingDto[],
  categoryBudgets: readonly TravelCategoryBudgetDto[],
): Promise<TravelSummaryDto> {
  const tripDays = countTravelDays(travel.startsAt, travel.endsAt);
  const budgetByCategory = new Map(
    categoryBudgets.map((budget) => [budget.category, budget.amount]),
  );
  const plannedByCategory = EMPTY_BY_CATEGORY();
  let plannedTotal = new Decimal(0);
  let fixedPlannedTotal = new Decimal(0);
  let flexiblePlannedTotal = new Decimal(0);

  for (const category of Object.values(TravelPlannedCategory)) {
    const budget = budgetByCategory.get(category);
    let categoryTotal: Decimal;
    if (budget) {
      categoryTotal = toDecimal(budget);
    } else {
      categoryTotal = plannedSpendings
        .filter((item) => item.category === category)
        .reduce(
          (sum, item) => sum.plus(toDecimal(item.amount)),
          new Decimal(0),
        );
    }
    plannedByCategory[category] = decimalToString(categoryTotal);
    plannedTotal = plannedTotal.plus(categoryTotal);
    if (FIXED_CATEGORIES.includes(category)) {
      fixedPlannedTotal = fixedPlannedTotal.plus(categoryTotal);
    } else {
      flexiblePlannedTotal = flexiblePlannedTotal.plus(categoryTotal);
    }
  }

  const actualTotalDecimal = await sumActualInCurrency(
    travel.transactions,
    travel.currency,
  );
  const actualTotal = toDecimal(actualTotalDecimal);

  return {
    plannedTotal: decimalToString(plannedTotal),
    plannedByCategory,
    fixedPlannedTotal: decimalToString(fixedPlannedTotal),
    flexiblePlannedTotal: decimalToString(flexiblePlannedTotal),
    actualTotal: actualTotalDecimal,
    avgPlannedPerDay: decimalToString(plannedTotal.div(tripDays)),
    avgActualPerDay: decimalToString(actualTotal.div(tripDays)),
    tripDays,
    maxSpendingGoal: travel.maxSpendingGoal
      ? decimalToString(toDecimal(travel.maxSpendingGoal.toString()))
      : null,
  };
}

function toListItem(
  travel: {
    readonly id: string;
    readonly title: string;
    readonly startsAt: Date;
    readonly endsAt: Date;
    readonly imageUrl: string | null;
    readonly placeLabel: string | null;
    readonly placeCountry: string | null;
    readonly placeCity: string | null;
    readonly currency: string;
    readonly phaseOverride: TravelPhase | null;
    readonly maxSpendingGoal: Prisma.Decimal | null;
  },
  plannedTotal: string,
  actualTotal: string,
): TravelListItemDto {
  return {
    id: travel.id,
    title: travel.title,
    startsAt: travel.startsAt.toISOString(),
    endsAt: travel.endsAt.toISOString(),
    imageUrl: travel.imageUrl,
    placeLabel: travel.placeLabel,
    placeCountry: travel.placeCountry,
    placeCity: travel.placeCity,
    currency: travel.currency,
    phase: resolveTravelPhase(travel),
    phaseOverride: travel.phaseOverride,
    maxSpendingGoal: travel.maxSpendingGoal
      ? decimalToString(toDecimal(travel.maxSpendingGoal.toString()))
      : null,
    plannedTotal,
    actualTotal,
  };
}

function mapPlannedSpending(row: {
  readonly id: string;
  readonly travelId: string;
  readonly title: string;
  readonly category: TravelPlannedCategory;
  readonly amount: Prisma.Decimal;
  readonly note: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): TravelPlannedSpendingDto {
  return {
    id: row.id,
    travelId: row.travelId,
    title: row.title,
    category: row.category,
    amount: decimalToString(toDecimal(row.amount.toString())),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapCategoryBudget(row: {
  readonly category: TravelPlannedCategory;
  readonly amount: Prisma.Decimal;
}): TravelCategoryBudgetDto {
  return {
    category: row.category,
    amount: decimalToString(toDecimal(row.amount.toString())),
  };
}

function computePlannedTotal(
  spendings: ReadonlyArray<{
    readonly category: TravelPlannedCategory;
    readonly amount: string;
  }>,
  budgets: ReadonlyArray<{
    readonly category: TravelPlannedCategory;
    readonly amount: string;
  }>,
): string {
  const budgetByCategory = new Map(
    budgets.map((budget) => [budget.category, budget.amount]),
  );
  let total = new Decimal(0);
  for (const category of Object.values(TravelPlannedCategory)) {
    const budget = budgetByCategory.get(category);
    if (budget) {
      total = total.plus(toDecimal(budget));
      continue;
    }
    for (const item of spendings) {
      if (item.category === category) {
        total = total.plus(toDecimal(item.amount));
      }
    }
  }
  return decimalToString(total);
}

async function assertCategoryUnlocked(
  travelId: string,
  category: TravelPlannedCategory,
): Promise<void> {
  const budget = await prisma.travelCategoryBudget.findUnique({
    where: { travelId_category: { travelId, category } },
    select: { id: true },
  });
  if (budget) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Category has a lump total; clear it to edit line items",
    );
  }
}

function mapAiReport(row: {
  readonly id: string;
  readonly type: TravelAiReportDto["type"];
  readonly reportMessage: string;
  readonly contextMessage: string | null;
  readonly responseLocale: string | null;
  readonly extras: Prisma.JsonValue;
  readonly model: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): TravelAiReportDto {
  return {
    id: row.id,
    type: row.type,
    reportMessage: row.reportMessage,
    contextMessage: row.contextMessage,
    responseLocale: row.responseLocale,
    extras: row.extras,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function sumActualInCurrency(
  rows: ReadonlyArray<{
    readonly amount: Prisma.Decimal;
    readonly originalAmount: Prisma.Decimal;
    readonly inputCurrency: string;
    readonly rateToRub: Prisma.Decimal;
    readonly fxRateDate: Date;
  }>,
  currency: string,
): Promise<string> {
  let total = new Decimal(0);
  for (const row of rows) {
    if (row.inputCurrency.toUpperCase() === currency.toUpperCase()) {
      total = total.plus(toDecimal(row.originalAmount.toString()));
      continue;
    }
    const display = await convertRubToDisplay(
      row.amount.toString(),
      currency,
      row.fxRateDate,
    );
    total = total.plus(toDecimal(display.amount));
  }
  return decimalToString(total);
}

function assertDateRange(startsAt: Date, endsAt: Date): void {
  if (endsAt.getTime() < startsAt.getTime()) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "End date must be on or after start date",
    );
  }
}

function parsePositiveMoney(value: string): Decimal {
  const amount = toDecimal(value);
  if (!amount.isFinite() || amount.lte(0)) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Amount must be a positive number",
    );
  }
  return amount;
}

/** Category lump totals may be zero (lock category with no planned spend). */
function parseNonNegativeMoney(value: string): Decimal {
  const amount = toDecimal(value);
  if (!amount.isFinite() || amount.lt(0)) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Amount must be zero or a positive number",
    );
  }
  return amount;
}

function parseOptionalMoney(
  value: string | null | undefined,
): Prisma.Decimal | null {
  if (value == null || value === "") {
    return null;
  }
  const amount = toDecimal(value);
  if (!amount.isFinite() || amount.lte(0)) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Max spending goal must be a positive number",
    );
  }
  return new Prisma.Decimal(amount.toFixed(4));
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
