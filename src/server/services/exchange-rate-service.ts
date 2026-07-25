import Decimal from "decimal.js";
import { subMonths } from "date-fns";

import { AppServiceError } from "@/lib/errors";
import { utcDateOnly } from "@/lib/dates";
import { decimalToString, toDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";

import type {
  DisplayMoney,
  ResolvedExchangeRate,
} from "./exchange-rate-service.types";

const RUB = "RUB";

/**
 * Stats endpoints convert every transaction to the display currency, and each
 * row is converted several times (totals, category pie, timeline). Rates for a
 * given currency+date are immutable once fetched, so we memoize resolutions to
 * collapse what was an O(rows) burst of identical DB queries into one per key.
 * A short TTL lets a freshly fetched "latest" fallback refresh within a day.
 */
const RATE_CACHE_TTL_MS = 10 * 60 * 1000;
const rateCache = new Map<string, { rate: ResolvedExchangeRate; expiresAt: number }>();

async function resolveRateUncached(
  normalized: string,
  targetDate: Date,
): Promise<ResolvedExchangeRate> {
  const onOrBefore = await findRateOnOrBefore(normalized, targetDate);
  if (onOrBefore) {
    return onOrBefore;
  }

  const latest = await prisma.exchangeRate.findFirst({
    where: { currency: normalized },
    orderBy: { rateDate: "desc" },
  });
  if (!latest) {
    throw new AppServiceError(
      ApiErrorCode.FxUnavailable,
      `No exchange rate available for ${normalized}`,
    );
  }
  return toResolvedRate(latest);
}

export async function resolveRateForCurrency(
  currency: string,
  occurredAt: Date,
): Promise<ResolvedExchangeRate> {
  const normalized = currency.toUpperCase();
  if (normalized === RUB) {
    return {
      currency: RUB,
      rateToRub: toDecimal(1),
      rateDate: utcDateOnly(occurredAt),
    };
  }

  const targetDate = utcDateOnly(occurredAt);
  const cacheKey = `${normalized}:${targetDate.toISOString().slice(0, 10)}`;
  const cached = rateCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rate;
  }

  const rate = await resolveRateUncached(normalized, targetDate);
  rateCache.set(cacheKey, { rate, expiresAt: Date.now() + RATE_CACHE_TTL_MS });
  return rate;
}

export async function convertRubToDisplay(
  amountRub: Decimal | string | number,
  displayCurrency: string,
  fxRateDate: Date,
): Promise<DisplayMoney> {
  const currency = displayCurrency.toUpperCase();
  const rub = toDecimal(amountRub);
  if (currency === RUB) {
    return { amount: decimalToString(rub), currency: RUB };
  }

  const rate = await resolveRateForCurrency(currency, fxRateDate);
  const display = rub.div(rate.rateToRub);
  return { amount: decimalToString(display), currency };
}

export async function hasMultipleCurrenciesForUser(
  userId: string,
): Promise<boolean> {
  const rows = await prisma.transaction.findMany({
    where: { userId },
    select: { inputCurrency: true },
    distinct: ["inputCurrency"],
    take: 2,
  });
  return rows.length > 1;
}

export type LatestRateToRub = {
  currency: string;
  rateToRub: string;
  rateDate: string;
  changePercent: number | null;
};

export async function listLatestRatesToRub(
  currencies: readonly string[],
): Promise<LatestRateToRub[]> {
  const today = utcDateOnly(new Date());
  const monthAgo = utcDateOnly(subMonths(today, 1));
  const rates: LatestRateToRub[] = [];

  for (const currency of currencies) {
    const normalized = currency.toUpperCase();
    if (normalized === RUB) {
      continue;
    }
    try {
      const current = await resolveRateForCurrency(normalized, today);
      const previous = await findRateOnOrBefore(normalized, monthAgo);
      rates.push({
        currency: current.currency,
        rateToRub: decimalToString(current.rateToRub),
        rateDate: current.rateDate.toISOString().slice(0, 10),
        changePercent: previous
          ? computeChangePercent(current.rateToRub, previous.rateToRub)
          : null,
      });
    } catch {
      // Skip currencies without a stored rate so the header stays usable.
    }
  }

  return rates;
}

function computeChangePercent(
  current: Decimal,
  previous: Decimal,
): number | null {
  if (previous.eq(0)) {
    return null;
  }
  const percent = current.minus(previous).div(previous).mul(100);
  return Number(percent.toDecimalPlaces(2).toString());
}

async function findRateOnOrBefore(
  currency: string,
  targetDate: Date,
): Promise<ResolvedExchangeRate | null> {
  const row = await prisma.exchangeRate.findFirst({
    where: {
      currency,
      rateDate: { lte: targetDate },
    },
    orderBy: { rateDate: "desc" },
  });
  return row ? toResolvedRate(row) : null;
}

function toResolvedRate(row: {
  currency: string;
  rateToRub: { toString(): string };
  rateDate: Date;
}): ResolvedExchangeRate {
  return {
    currency: row.currency,
    rateToRub: toDecimal(row.rateToRub.toString()),
    rateDate: row.rateDate,
  };
}
