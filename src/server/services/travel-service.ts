import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";

import { AppServiceError } from "@/lib/errors";
import { decimalToString, toDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  countTravelDays,
  resolveTravelPhase,
} from "@/lib/travel-phase";
import {
  isOwnedTravelObjectUrl,
  travelTicketProxyUrl,
  deleteTravelTicketObject,
} from "@/server/services/storage-service";
import { ApiErrorCode } from "@/types/api";
import {
  TravelPhase,
  TravelPlannedCategory,
  TransactionType,
} from "@/types/enums";

import { convertRubToDisplay } from "./exchange-rate-service";
import type {
  CreatePlaceToVisitInput,
  CreatePlannedSpendingInput,
  CreateThingToGrabInput,
  CreateTravelInput,
  CreateTravelTicketInput,
  TravelAiReportDto,
  TravelCategoryBudgetDto,
  TravelDetailDto,
  TravelListItemDto,
  TravelPlaceToVisitDto,
  TravelPlannedSpendingDto,
  TravelSuggestItemDto,
  TravelSummaryDto,
  TravelThingToGrabDto,
  TravelTicketDto,
  UpdatePlaceToVisitInput,
  UpdatePlannedSpendingInput,
  UpdateThingToGrabInput,
  UpdateTravelInput,
  UpdateTravelTicketInput,
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
      placesToVisit: {
        orderBy: [{ isChecked: "asc" }, { createdAt: "asc" }],
      },
      thingsToGrab: {
        orderBy: [{ isChecked: "asc" }, { createdAt: "asc" }],
      },
      tickets: { orderBy: { createdAt: "asc" } },
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
  const placesToVisit = travel.placesToVisit.map(mapPlaceToVisit);
  const thingsToGrab = travel.thingsToGrab.map(mapThingToGrab);
  const tickets = travel.tickets.map(mapTicket);
  const summary = await buildSummary(travel, plannedSpendings, categoryBudgets);
  return {
    ...toListItem(travel, summary.plannedTotal, summary.actualTotal),
    placeCountry: travel.placeCountry,
    placeCity: travel.placeCity,
    housingAddress: travel.housingAddress,
    housingLatitude: toNumberOrNull(travel.housingLatitude),
    housingLongitude: toNumberOrNull(travel.housingLongitude),
    housingFloor: travel.housingFloor,
    housingEntrance: travel.housingEntrance,
    housingApartment: travel.housingApartment,
    plannedSpendings,
    categoryBudgets,
    placesToVisit,
    thingsToGrab,
    tickets,
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
        housingAddress: emptyToNull(input.housingAddress),
        housingLatitude: input.housingLatitude ?? null,
        housingLongitude: input.housingLongitude ?? null,
        housingFloor: emptyToNull(input.housingFloor),
        housingEntrance: emptyToNull(input.housingEntrance),
        housingApartment: emptyToNull(input.housingApartment),
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
        housingAddress:
          input.housingAddress === undefined
            ? undefined
            : emptyToNull(input.housingAddress),
        housingLatitude:
          input.housingLatitude === undefined
            ? undefined
            : input.housingLatitude,
        housingLongitude:
          input.housingLongitude === undefined
            ? undefined
            : input.housingLongitude,
        housingFloor:
          input.housingFloor === undefined
            ? undefined
            : emptyToNull(input.housingFloor),
        housingEntrance:
          input.housingEntrance === undefined
            ? undefined
            : emptyToNull(input.housingEntrance),
        housingApartment:
          input.housingApartment === undefined
            ? undefined
            : emptyToNull(input.housingApartment),
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

const UPCOMING_TRAVEL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** In-progress travel, or nearest preparing trip starting within 30 days. */
export async function getActiveTravel(
  userId: string,
): Promise<TravelListItemDto | null> {
  const travels = await listTravels(userId);
  const inProgress = travels.find(
    (travel) => travel.phase === TravelPhase.InProgress,
  );
  if (inProgress) {
    return inProgress;
  }

  const now = Date.now();
  const windowEnd = now + UPCOMING_TRAVEL_WINDOW_MS;
  const upcoming = travels
    .filter((travel) => travel.phase === TravelPhase.Prepares)
    .filter((travel) => {
      const startsAt = new Date(travel.startsAt).getTime();
      const endsAt = new Date(travel.endsAt).getTime();
      // Upcoming within the window, or already started but not finished.
      return startsAt <= windowEnd && endsAt >= now;
    })
    .sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );
  return upcoming[0] ?? null;
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

export async function createPlaceToVisit(
  input: CreatePlaceToVisitInput,
): Promise<TravelPlaceToVisitDto> {
  await requireOwnedTravel(input.userId, input.travelId);
  const created = await prisma.travelPlaceToVisit.create({
    data: {
      travelId: input.travelId,
      title: input.title.trim(),
      link: emptyToNull(input.link),
      address: emptyToNull(input.address),
    },
  });
  return mapPlaceToVisit(created);
}

export async function updatePlaceToVisit(
  input: UpdatePlaceToVisitInput,
): Promise<TravelPlaceToVisitDto> {
  await requireOwnedTravel(input.userId, input.travelId);
  const existing = await prisma.travelPlaceToVisit.findFirst({
    where: { id: input.placeId, travelId: input.travelId },
  });
  if (!existing) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Place to visit not found");
  }
  const updated = await prisma.travelPlaceToVisit.update({
    where: { id: existing.id },
    data: {
      title: input.title?.trim(),
      link: input.link === undefined ? undefined : emptyToNull(input.link),
      address:
        input.address === undefined ? undefined : emptyToNull(input.address),
      isChecked: input.isChecked,
    },
  });
  return mapPlaceToVisit(updated);
}

export async function deletePlaceToVisit(input: {
  readonly userId: string;
  readonly travelId: string;
  readonly placeId: string;
}): Promise<void> {
  await requireOwnedTravel(input.userId, input.travelId);
  const result = await prisma.travelPlaceToVisit.deleteMany({
    where: { id: input.placeId, travelId: input.travelId },
  });
  if (result.count === 0) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Place to visit not found");
  }
}

export async function createThingToGrab(
  input: CreateThingToGrabInput,
): Promise<TravelThingToGrabDto> {
  await requireOwnedTravel(input.userId, input.travelId);
  const amount = parsePositiveQuantity(input.amount);
  const created = await prisma.travelThingToGrab.create({
    data: {
      travelId: input.travelId,
      title: input.title.trim(),
      amount,
    },
  });
  return mapThingToGrab(created);
}

export async function updateThingToGrab(
  input: UpdateThingToGrabInput,
): Promise<TravelThingToGrabDto> {
  await requireOwnedTravel(input.userId, input.travelId);
  const existing = await prisma.travelThingToGrab.findFirst({
    where: { id: input.itemId, travelId: input.travelId },
  });
  if (!existing) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Thing to grab not found");
  }
  const amount =
    input.amount === undefined
      ? undefined
      : parsePositiveQuantity(input.amount);
  const updated = await prisma.travelThingToGrab.update({
    where: { id: existing.id },
    data: {
      title: input.title?.trim(),
      amount,
      isChecked: input.isChecked,
    },
  });
  return mapThingToGrab(updated);
}

export async function deleteThingToGrab(input: {
  readonly userId: string;
  readonly travelId: string;
  readonly itemId: string;
}): Promise<void> {
  await requireOwnedTravel(input.userId, input.travelId);
  const result = await prisma.travelThingToGrab.deleteMany({
    where: { id: input.itemId, travelId: input.travelId },
  });
  if (result.count === 0) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Thing to grab not found");
  }
}

export async function createTravelTicket(
  input: CreateTravelTicketInput,
): Promise<TravelTicketDto> {
  await requireOwnedTravel(input.userId, input.travelId);
  if (!isOwnedTravelObjectUrl(input.fileUrl)) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Ticket file must be an uploaded travel file",
    );
  }
  const created = await prisma.travelTicket.create({
    data: {
      travelId: input.travelId,
      title: input.title.trim(),
      fileUrl: input.fileUrl,
      fileName: input.fileName.trim(),
      contentType: input.contentType.trim(),
      origin: normalizeSegmentText(input.origin),
      destination: normalizeSegmentText(input.destination),
      departsAt: input.departsAt ?? null,
      arrivesAt: input.arrivesAt ?? null,
      ticketNumber: normalizeSegmentText(input.ticketNumber),
      flightNumber: normalizeSegmentText(input.flightNumber),
      bookingCode: normalizeSegmentText(input.bookingCode),
    },
  });
  return mapTicket(created);
}

function normalizeSegmentText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

export async function updateTravelTicket(
  input: UpdateTravelTicketInput,
): Promise<TravelTicketDto> {
  await requireOwnedTravel(input.userId, input.travelId);
  const existing = await prisma.travelTicket.findFirst({
    where: { id: input.ticketId, travelId: input.travelId },
  });
  if (!existing) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Travel ticket not found");
  }
  const updated = await prisma.travelTicket.update({
    where: { id: existing.id },
    data: {
      title: input.title?.trim(),
    },
  });
  return mapTicket(updated);
}

export async function deleteTravelTicket(input: {
  readonly userId: string;
  readonly travelId: string;
  readonly ticketId: string;
}): Promise<void> {
  await requireOwnedTravel(input.userId, input.travelId);
  const existing = await prisma.travelTicket.findFirst({
    where: { id: input.ticketId, travelId: input.travelId },
  });
  if (!existing) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Travel ticket not found");
  }
  await prisma.travelTicket.delete({ where: { id: existing.id } });
  const siblings = await prisma.travelTicket.count({
    where: { fileUrl: existing.fileUrl },
  });
  if (siblings === 0) {
    await deleteTravelTicketObject(existing.fileUrl);
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

function mapPlaceToVisit(row: {
  readonly id: string;
  readonly travelId: string;
  readonly title: string;
  readonly link: string | null;
  readonly address: string | null;
  readonly isChecked: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): TravelPlaceToVisitDto {
  return {
    id: row.id,
    travelId: row.travelId,
    title: row.title,
    link: row.link,
    address: row.address,
    isChecked: row.isChecked,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapThingToGrab(row: {
  readonly id: string;
  readonly travelId: string;
  readonly title: string;
  readonly amount: number;
  readonly isChecked: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): TravelThingToGrabDto {
  return {
    id: row.id,
    travelId: row.travelId,
    title: row.title,
    amount: row.amount,
    isChecked: row.isChecked,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapTicket(row: {
  readonly id: string;
  readonly travelId: string;
  readonly title: string;
  readonly fileUrl: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly origin: string | null;
  readonly destination: string | null;
  readonly departsAt: Date | null;
  readonly arrivesAt: Date | null;
  readonly ticketNumber: string | null;
  readonly flightNumber: string | null;
  readonly bookingCode: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): TravelTicketDto {
  return {
    id: row.id,
    travelId: row.travelId,
    title: row.title,
    fileUrl: travelTicketProxyUrl(row.fileUrl),
    fileName: row.fileName,
    contentType: row.contentType,
    origin: row.origin,
    destination: row.destination,
    departsAt: row.departsAt?.toISOString() ?? null,
    arrivesAt: row.arrivesAt?.toISOString() ?? null,
    ticketNumber: row.ticketNumber,
    flightNumber: row.flightNumber,
    bookingCode: row.bookingCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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

function parsePositiveQuantity(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Quantity must be a positive whole number",
    );
  }
  return value;
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

function toNumberOrNull(value: { toString(): string } | null): number | null {
  return value === null ? null : Number(value.toString());
}
