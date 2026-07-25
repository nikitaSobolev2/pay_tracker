import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const DEFAULT_BACKFILL_DAYS = 40;

function getAllowlist(): string[] {
  const raw = process.env.DEFAULT_CURRENCIES ?? "RUB,USD,EUR";
  return raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

function getBackfillDays(): number {
  const raw = Number(process.env.FX_BACKFILL_DAYS ?? DEFAULT_BACKFILL_DAYS);
  if (!Number.isFinite(raw) || raw < 1) {
    return DEFAULT_BACKFILL_DAYS;
  }
  return Math.floor(raw);
}

function utcDateOnly(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return utcDateOnly(next);
}

type FrankfurterRateRow = {
  date: string;
  base: string;
  quote: string;
  rate: number;
};

type DayRates = {
  rateDate: Date;
  rates: Record<string, number>;
};

async function fetchFrankfurterRange(
  baseUrl: string,
  currencies: string[],
  from: Date,
  to: Date,
): Promise<DayRates[]> {
  const nonRub = currencies.filter((c) => c !== "RUB");
  const quotes = ["RUB", ...nonRub.filter((c) => c !== "USD")];
  const uniqueQuotes = [...new Set(quotes)];
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/v2/rates`);
  url.searchParams.set("base", "USD");
  url.searchParams.set("quotes", uniqueQuotes.join(","));
  url.searchParams.set("from", formatUtcDate(from));
  url.searchParams.set("to", formatUtcDate(to));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Frankfurter HTTP ${response.status}`);
  }
  const data = (await response.json()) as FrankfurterRateRow[];
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Empty FX response");
  }

  const byDate = new Map<string, Map<string, number>>();
  for (const row of data) {
    if (!(row.rate > 0)) {
      continue;
    }
    const day = byDate.get(row.date) ?? new Map<string, number>();
    day.set(row.quote, row.rate);
    byDate.set(row.date, day);
  }

  const days: DayRates[] = [];
  for (const [date, quotesMap] of [...byDate.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const rubRate = quotesMap.get("RUB");
    if (!rubRate || !(rubRate > 0)) {
      console.warn(`Skipping ${date}: missing RUB rate`);
      continue;
    }

    const rates: Record<string, number> = { RUB: 1, USD: rubRate };
    let incomplete = false;
    for (const currency of nonRub) {
      if (currency === "USD") {
        continue;
      }
      const quoteRate = quotesMap.get(currency);
      if (!quoteRate || !(quoteRate > 0)) {
        console.warn(`Skipping ${date}: missing ${currency} rate`);
        incomplete = true;
        break;
      }
      rates[currency] = rubRate / quoteRate;
    }
    if (incomplete) {
      continue;
    }

    days.push({
      rateDate: new Date(`${date}T00:00:00.000Z`),
      rates,
    });
  }

  if (days.length === 0) {
    throw new Error("No complete FX days in response");
  }
  return days;
}

async function upsertDayRates(
  day: DayRates,
  fetchedAt: Date,
  source: string,
): Promise<number> {
  let saved = 0;
  for (const [currency, rateToRub] of Object.entries(day.rates)) {
    if (!Number.isFinite(rateToRub) || rateToRub <= 0) {
      throw new Error(`Invalid rate for ${currency} on ${formatUtcDate(day.rateDate)}`);
    }
    await prisma.exchangeRate.upsert({
      where: {
        currency_rateDate: {
          currency,
          rateDate: day.rateDate,
        },
      },
      create: {
        currency,
        rateToRub,
        rateDate: day.rateDate,
        fetchedAt,
        source,
      },
      update: {
        rateToRub,
        fetchedAt,
        source,
      },
    });
    saved += 1;
  }
  return saved;
}

async function countExistingDays(
  currencies: string[],
  from: Date,
  to: Date,
): Promise<number> {
  const needed = currencies.filter((c) => c !== "RUB");
  if (needed.length === 0) {
    return 0;
  }
  const rows = await prisma.exchangeRate.findMany({
    where: {
      currency: { in: needed },
      rateDate: { gte: from, lte: to },
    },
    distinct: ["rateDate"],
    select: { rateDate: true },
  });
  return rows.length;
}

async function main(): Promise<void> {
  const currencies = getAllowlist();
  const backfillDays = getBackfillDays();
  const today = utcDateOnly();
  const from = shiftUtcDays(today, -(backfillDays - 1));
  const baseUrl = process.env.FX_API_BASE_URL ?? "https://api.frankfurter.dev";
  const source = process.env.FX_PROVIDER ?? "frankfurter";

  console.log(
    `FX backfill ${formatUtcDate(from)} → ${formatUtcDate(today)} (${backfillDays} days)`,
  );

  const beforeCount = await countExistingDays(currencies, from, today);
  const days = await fetchFrankfurterRange(baseUrl, currencies, from, today);
  const fetchedAt = new Date();
  let upserted = 0;
  for (const day of days) {
    upserted += await upsertDayRates(day, fetchedAt, source);
  }

  console.log(
    `Saved ${upserted} FX rows across ${days.length} market days` +
      ` (had ${beforeCount} distinct dates in window before)`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
