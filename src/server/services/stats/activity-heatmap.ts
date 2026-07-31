import { eachDayOfInterval, endOfDay, format, startOfDay, startOfWeek, subWeeks } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import Decimal from "decimal.js";

import { attributeCashflowAmount, includeRowInCashflow } from "@/lib/cashflow-kinds";
import { decimalToString, toDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { TransactionType } from "@/types/enums";

import { convertRubToDisplay } from "../exchange-rate-service";
import { buildTransactionWhere } from "../transaction-service";
import type {
  ActivityHeatmap,
  ActivityHeatmapDay,
  ActivityHeatmapInput,
} from "../stats-service.types";

/** GitHub-style grid: trailing 53 columns × 7 rows, aligned to Monday. */
const WEEKS = 52;

export async function getActivityHeatmap(
  input: ActivityHeatmapInput,
): Promise<ActivityHeatmap> {
  const zonedNow = toZonedTime(new Date(), input.timezone);
  const startLocal = startOfWeek(subWeeks(startOfDay(zonedNow), WEEKS), {
    weekStartsOn: 1,
  });
  const endLocal = endOfDay(zonedNow);
  const start = fromZonedTime(startLocal, input.timezone);
  const end = fromZonedTime(endLocal, input.timezone);

  const where = buildTransactionWhere({
    userId: input.userId,
    timezone: input.timezone,
    type: input.type,
    kinds: input.kinds,
    categoryIds: input.categoryIds,
    counterpartyIds: input.counterpartyIds,
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
  for (const day of eachDayOfInterval({ start: startLocal, end: endLocal })) {
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
    const key = format(toZonedTime(row.occurredAt, input.timezone), "yyyy-MM-dd");
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
    start: format(startLocal, "yyyy-MM-dd"),
    end: format(endLocal, "yyyy-MM-dd"),
    days,
    maxEarning: decimalToString(maxEarning),
    maxSpending: decimalToString(maxSpending),
  };
}
