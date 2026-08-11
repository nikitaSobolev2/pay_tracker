import {
  addWeeks,
  differenceInCalendarWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import Decimal from "decimal.js";

import { attributeCashflowAmount, includeRowInCashflow } from "@/lib/cashflow-kinds";
import { AppServiceError } from "@/lib/errors";
import { decimalToString, toDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import { TransactionType } from "@/types/enums";

import { convertRubToDisplay } from "../exchange-rate-service";
import { buildTransactionWhere } from "../transaction-service";
import type {
  ActivityHeatmap,
  ActivityHeatmapDay,
  ActivityHeatmapInput,
} from "../stats-service.types";

/** GitHub-style grid: trailing 53 columns × 7 rows, aligned to Monday. */
const DEFAULT_WEEKS = 52;
/** Short trips still render ~7 week columns so cells stay compact. */
const MIN_TRAVEL_HEATMAP_WEEKS = 7;

type LocalRange = {
  readonly startLocal: Date;
  readonly endLocal: Date;
};

export async function getActivityHeatmap(
  input: ActivityHeatmapInput,
): Promise<ActivityHeatmap> {
  const range = await resolveHeatmapLocalRange(input);
  const start = fromZonedTime(range.startLocal, input.timezone);
  const end = fromZonedTime(range.endLocal, input.timezone);

  const where = buildTransactionWhere({
    userId: input.userId,
    timezone: input.timezone,
    type: input.type,
    kinds: input.kinds,
    categoryIds: input.categoryIds,
    counterpartyIds: input.counterpartyIds,
    travelId: input.travelId,
    hideUncategorized: input.hideUncategorized,
  });
  where.occurredAt = { gte: start, lte: end };

  const rows = await prisma.transaction.findMany({
    where,
    select: {
      occurredAt: true,
      type: true,
      kind: true,
      amount: true,
      fxRateDate: true,
    },
  });

  const earning = new Map<string, Decimal>();
  const spending = new Map<string, Decimal>();
  for (const day of eachDayOfInterval({
    start: range.startLocal,
    end: range.endLocal,
  })) {
    const key = format(day, "yyyy-MM-dd");
    earning.set(key, toDecimal(0));
    spending.set(key, toDecimal(0));
  }

  let maxEarning = toDecimal(0);
  let maxSpending = toDecimal(0);
  for (const row of rows) {
    if (!includeRowInCashflow(row.kind, input.kinds)) {
      continue;
    }
    const key = format(
      toZonedTime(row.occurredAt, input.timezone),
      "yyyy-MM-dd",
    );
    if (!earning.has(key)) {
      continue;
    }
    const display = await convertRubToDisplay(
      row.amount.toString(),
      input.displayCurrency,
      row.fxRateDate,
    );
    const amount = toDecimal(display.amount);
    const attributed = attributeCashflowAmount(row, amount);
    if (attributed.type === TransactionType.Earning) {
      const next = (earning.get(key) ?? toDecimal(0)).plus(attributed.amount);
      earning.set(key, next);
      maxEarning = Decimal.max(maxEarning, next.abs());
    } else if (attributed.type === TransactionType.Spending) {
      const next = (spending.get(key) ?? toDecimal(0)).plus(attributed.amount);
      spending.set(key, next);
      maxSpending = Decimal.max(maxSpending, next.abs());
    }
  }

  const days: ActivityHeatmapDay[] = [...earning.keys()].map((date) => ({
    date,
    earning: decimalToString(earning.get(date) ?? toDecimal(0)),
    spending: decimalToString(spending.get(date) ?? toDecimal(0)),
  }));

  return {
    displayCurrency: input.displayCurrency,
    start: format(range.startLocal, "yyyy-MM-dd"),
    end: format(range.endLocal, "yyyy-MM-dd"),
    days,
    maxEarning: decimalToString(maxEarning),
    maxSpending: decimalToString(maxSpending),
  };
}

async function resolveHeatmapLocalRange(
  input: ActivityHeatmapInput,
): Promise<LocalRange> {
  if (input.travelId) {
    return resolveTravelHeatmapLocalRange(input);
  }

  if (input.startDate && input.endDate) {
    const startLocal = startOfWeek(startOfDay(parseISO(input.startDate)), {
      weekStartsOn: 1,
    });
    const endLocal = endOfWeek(endOfDay(parseISO(input.endDate)), {
      weekStartsOn: 1,
    });
    return { startLocal, endLocal };
  }

  const zonedNow = toZonedTime(new Date(), input.timezone);
  const startLocal = startOfWeek(subWeeks(startOfDay(zonedNow), DEFAULT_WEEKS), {
    weekStartsOn: 1,
  });
  const endLocal = endOfDay(zonedNow);
  return { startLocal, endLocal };
}

/**
 * Travel heatmap window:
 * start = travel start, or earlier first linked transaction
 * end = travel end, or later last linked transaction
 */
async function resolveTravelHeatmapLocalRange(
  input: ActivityHeatmapInput,
): Promise<LocalRange> {
  const travelId = input.travelId;
  if (!travelId) {
    throw new AppServiceError(ApiErrorCode.Validation, "travelId required");
  }

  const travel = await prisma.travel.findFirst({
    where: { id: travelId, userId: input.userId },
    select: { startsAt: true, endsAt: true },
  });
  if (!travel) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Travel not found");
  }

  const bounds = await prisma.transaction.aggregate({
    where: {
      userId: input.userId,
      travelId,
      isDeleted: false,
      ...(input.type ? { type: input.type } : {}),
    },
    _min: { occurredAt: true },
    _max: { occurredAt: true },
  });

  const travelStart = startOfDay(toZonedTime(travel.startsAt, input.timezone));
  const travelEnd = endOfDay(toZonedTime(travel.endsAt, input.timezone));
  const firstTx = bounds._min.occurredAt
    ? startOfDay(toZonedTime(bounds._min.occurredAt, input.timezone))
    : null;
  const lastTx = bounds._max.occurredAt
    ? endOfDay(toZonedTime(bounds._max.occurredAt, input.timezone))
    : null;

  const rangeStart =
    firstTx && firstTx.getTime() < travelStart.getTime()
      ? firstTx
      : travelStart;
  const rangeEnd =
    lastTx && lastTx.getTime() > travelEnd.getTime() ? lastTx : travelEnd;

  let startLocal = startOfWeek(rangeStart, { weekStartsOn: 1 });
  let endLocal = endOfWeek(rangeEnd, { weekStartsOn: 1 });
  const weekCount =
    differenceInCalendarWeeks(endLocal, startLocal, { weekStartsOn: 1 }) + 1;
  if (weekCount < MIN_TRAVEL_HEATMAP_WEEKS) {
    endLocal = endOfWeek(
      addWeeks(startLocal, MIN_TRAVEL_HEATMAP_WEEKS - 1),
      { weekStartsOn: 1 },
    );
  }

  return { startLocal, endLocal };
}
