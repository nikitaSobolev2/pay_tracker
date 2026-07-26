import { Prisma } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";

import { toDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { classifySearchQuery } from "@/lib/search/query-classify";
import { TransactionKind } from "@/types/enums";

import { toCategoryDtos } from "./category-service";
import { convertRubToDisplay } from "./exchange-rate-service";
import type {
  SearchCategoryHit,
  SearchCounterpartyHit,
  SearchDateRangeHit,
  SearchDebtHit,
  SearchInput,
  SearchResponse,
  SearchTransactionHit,
} from "./search-service.types";

const DEFAULT_LIMIT = 10;

type TxRow = Prisma.TransactionGetPayload<{
  include: {
    counterparty: true;
    categories: { include: { category: true } };
  };
}>;

export async function searchAll(input: SearchInput): Promise<SearchResponse> {
  const limit = input.limitPerGroup ?? DEFAULT_LIMIT;
  const empty: SearchResponse = {
    query: input.query,
    queryKind: "empty",
    groups: {
      categories: [],
      counterparties: [],
      debts: [],
      dateRanges: [],
      transactions: [],
    },
  };

  const classified = classifySearchQuery(input.query, input.timezone);
  if (!classified) {
    return empty;
  }

  if (classified.kind === "date") {
    const dateRanges: SearchDateRangeHit[] = [
      {
        kind: "dateRange",
        label: classified.range.label,
        // Transactions filters expect YYYY-MM-DD (not ISO timestamps).
        startDate: formatInTimeZone(
          classified.range.start,
          input.timezone,
          "yyyy-MM-dd",
        ),
        endDate: formatInTimeZone(
          classified.range.end,
          input.timezone,
          "yyyy-MM-dd",
        ),
        score: 1,
      },
    ];
    const transactions = await searchTransactionsByDate(
      input,
      classified.range.start,
      classified.range.end,
      limit,
    );
    return {
      query: input.query,
      queryKind: "date",
      groups: {
        categories: [],
        counterparties: [],
        debts: [],
        dateRanges,
        transactions,
      },
    };
  }

  if (classified.kind === "amount") {
    const transactions = await searchTransactionsByAmount(
      input,
      classified.amountNeedle,
      limit,
    );
    return {
      query: input.query,
      queryKind: "amount",
      groups: {
        categories: [],
        counterparties: [],
        debts: [],
        dateRanges: [],
        transactions,
      },
    };
  }

  const needle = classified.normalized;
  const [categories, counterparties, titleTransactions] = await Promise.all([
    searchCategories(input.userId, needle, limit),
    searchCounterparties(input.userId, needle, limit),
    searchTransactionsByTitle(input, needle, limit),
  ]);

  const debts = await searchDebtsForCounterparties(
    input,
    counterparties,
    limit,
  );

  let categoryTransactions: SearchTransactionHit[] = [];
  if (categories.length > 0) {
    categoryTransactions = await searchTransactionsByCategoryIds(
      input,
      categories.map((item) => item.id),
      limit,
    );
  }

  const counterpartyTransactions =
    counterparties.length > 0
      ? await searchTransactionsByCounterpartyIds(
          input,
          counterparties.map((item) => item.id),
          limit,
        )
      : [];

  const transactions = mergeTransactionHits(
    [...categoryTransactions, ...counterpartyTransactions, ...titleTransactions],
    limit,
  );

  return {
    query: input.query,
    queryKind: "text",
    groups: {
      categories,
      counterparties,
      debts,
      dateRanges: [],
      transactions,
    },
  };
}

async function searchCategories(
  userId: string,
  needle: string,
  limit: number,
): Promise<SearchCategoryHit[]> {
  const rows = await prisma.userCategory.findMany({
    where: {
      userId,
      OR: [
        { title: { contains: needle, mode: "insensitive" } },
      ],
    },
    take: 80,
    select: {
      id: true,
      title: true,
      type: true,
      parentCategoryId: true,
    },
  });

  const dtos = await toCategoryDtos(rows);
  const scored = dtos
    .map((dto) => {
      const pathScore = textScore(dto.path.toLowerCase(), needle);
      const titleScore = textScore(dto.title.toLowerCase(), needle);
      const score = Math.max(pathScore, titleScore);
      return {
        kind: "category" as const,
        id: dto.id,
        title: dto.title,
        path: dto.path,
        type: dto.type,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Also match path segments that weren't caught by title ILIKE (e.g. full path typing)
  if (scored.length < limit && needle.includes("/")) {
    const all = await prisma.userCategory.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        type: true,
        parentCategoryId: true,
      },
    });
    const allDtos = await toCategoryDtos(all);
    const existing = new Set(scored.map((item) => item.id));
    for (const dto of allDtos) {
      if (existing.has(dto.id)) {
        continue;
      }
      const score = textScore(dto.path.toLowerCase(), needle);
      if (score <= 0) {
        continue;
      }
      scored.push({
        kind: "category",
        id: dto.id,
        title: dto.title,
        path: dto.path,
        type: dto.type,
        score,
      });
    }
    scored.sort((a, b) => b.score - a.score);
  }

  return scored.slice(0, limit);
}

async function searchCounterparties(
  userId: string,
  needle: string,
  limit: number,
): Promise<SearchCounterpartyHit[]> {
  const rows = await prisma.userCounterparty.findMany({
    where: {
      userId,
      name: { contains: needle, mode: "insensitive" },
    },
    take: 40,
    select: { id: true, name: true },
  });

  return rows
    .map((row) => ({
      kind: "counterparty" as const,
      id: row.id,
      name: row.name,
      score: textScore(row.name.toLowerCase(), needle),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function searchDebtsForCounterparties(
  input: SearchInput,
  counterparties: SearchCounterpartyHit[],
  limit: number,
): Promise<SearchDebtHit[]> {
  if (counterparties.length === 0) {
    return [];
  }

  const ids = counterparties.map((item) => item.id);
  const rows = await prisma.transaction.findMany({
    where: {
      userId: input.userId,
      isDeleted: false,
      counterpartyId: { in: ids },
      kind: {
        in: [TransactionKind.Loan, TransactionKind.Debt],
      },
    },
    select: {
      counterpartyId: true,
      kind: true,
      amount: true,
      fxRateDate: true,
      counterparty: { select: { id: true, name: true } },
    },
  });

  const byParty = new Map<
    string,
    {
      name: string;
      lend: typeof rows;
      borrow: typeof rows;
    }
  >();

  for (const row of rows) {
    if (!row.counterpartyId || !row.counterparty) {
      continue;
    }
    const bucket = byParty.get(row.counterpartyId) ?? {
      name: row.counterparty.name,
      lend: [],
      borrow: [],
    };
    if (row.kind === TransactionKind.Loan) {
      bucket.lend.push(row);
    } else if (row.kind === TransactionKind.Debt) {
      bucket.borrow.push(row);
    }
    byParty.set(row.counterpartyId, bucket);
  }

  const hits: SearchDebtHit[] = [];
  for (const [counterpartyId, bucket] of byParty) {
    const owedToMe = await sumRubRows(bucket.lend, input.displayCurrency);
    const iOwe = await sumRubRows(bucket.borrow, input.displayCurrency);
    const net = owedToMe.minus(iOwe);
    if (net.isZero()) {
      continue;
    }
    const cpScore =
      counterparties.find((item) => item.id === counterpartyId)?.score ?? 0.5;
    hits.push({
      kind: "debt",
      counterpartyId,
      name: bucket.name,
      tone: net.gt(0) ? "owed" : "owe",
      totalAllTimeAmount: net.abs().toFixed(),
      displayCurrency: input.displayCurrency,
      score: cpScore,
    });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

async function searchTransactionsByDate(
  input: SearchInput,
  start: Date,
  end: Date,
  limit: number,
): Promise<SearchTransactionHit[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId: input.userId,
      isDeleted: false,
      occurredAt: { gte: start, lte: end },
    },
    include: {
      counterparty: true,
      categories: { include: { category: true } },
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return mapTxHits(rows, input.displayCurrency, () => 0.9);
}

async function searchTransactionsByAmount(
  input: SearchInput,
  amountNeedle: string,
  limit: number,
): Promise<SearchTransactionHit[]> {
  const rows = await prisma.transaction.findMany({
    where: { userId: input.userId, isDeleted: false },
    include: {
      counterparty: true,
      categories: { include: { category: true } },
    },
    orderBy: [{ occurredAt: "desc" }],
    take: 400,
  });

  const filtered = rows.filter((row) => {
    const original = row.originalAmount.toString();
    return (
      original === amountNeedle ||
      original.startsWith(amountNeedle) ||
      original.includes(amountNeedle)
    );
  });

  return mapTxHits(filtered.slice(0, limit), input.displayCurrency, (row) => {
    const original = row.originalAmount.toString();
    if (original === amountNeedle) {
      return 1;
    }
    if (original.startsWith(amountNeedle)) {
      return 0.9;
    }
    return 0.7;
  });
}

async function searchTransactionsByTitle(
  input: SearchInput,
  needle: string,
  limit: number,
): Promise<SearchTransactionHit[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId: input.userId,
      isDeleted: false,
      title: { contains: needle, mode: "insensitive" },
    },
    include: {
      counterparty: true,
      categories: { include: { category: true } },
    },
    orderBy: [{ occurredAt: "desc" }],
    take: limit * 2,
  });
  const hits = await mapTxHits(rows, input.displayCurrency, (row) =>
    textScore((row.title ?? "").toLowerCase(), needle),
  );
  return hits.slice(0, limit);
}

async function searchTransactionsByCategoryIds(
  input: SearchInput,
  categoryIds: string[],
  limit: number,
): Promise<SearchTransactionHit[]> {
  const descendantIds = await expandCategoryIdsWithDescendants(
    input.userId,
    categoryIds,
  );
  const rows = await prisma.transaction.findMany({
    where: {
      userId: input.userId,
      isDeleted: false,
      categories: { some: { categoryId: { in: descendantIds } } },
    },
    include: {
      counterparty: true,
      categories: { include: { category: true } },
    },
    orderBy: [{ occurredAt: "desc" }],
    take: limit,
  });
  return mapTxHits(rows, input.displayCurrency, () => 0.75);
}

async function searchTransactionsByCounterpartyIds(
  input: SearchInput,
  counterpartyIds: string[],
  limit: number,
): Promise<SearchTransactionHit[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId: input.userId,
      isDeleted: false,
      counterpartyId: { in: counterpartyIds },
    },
    include: {
      counterparty: true,
      categories: { include: { category: true } },
    },
    orderBy: [{ occurredAt: "desc" }],
    take: limit,
  });
  return mapTxHits(rows, input.displayCurrency, () => 0.8);
}

async function expandCategoryIdsWithDescendants(
  userId: string,
  rootIds: string[],
): Promise<string[]> {
  const all = await prisma.userCategory.findMany({
    where: { userId },
    select: { id: true, parentCategoryId: true },
  });
  const childrenByParent = new Map<string, string[]>();
  for (const row of all) {
    if (!row.parentCategoryId) {
      continue;
    }
    const list = childrenByParent.get(row.parentCategoryId) ?? [];
    list.push(row.id);
    childrenByParent.set(row.parentCategoryId, list);
  }

  const result = new Set(rootIds);
  const queue = [...rootIds];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const child of childrenByParent.get(current) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        queue.push(child);
      }
    }
  }
  return [...result];
}

async function mapTxHits(
  rows: TxRow[],
  displayCurrency: string,
  scoreOf: (row: TxRow) => number,
): Promise<SearchTransactionHit[]> {
  const categoryRows = rows.flatMap((row) =>
    row.categories.map((link) => link.category),
  );
  const unique = new Map(categoryRows.map((row) => [row.id, row]));
  const dtos = await toCategoryDtos([...unique.values()]);
  const pathById = new Map(dtos.map((dto) => [dto.id, dto.path]));

  const hits: SearchTransactionHit[] = [];
  for (const row of rows) {
    const display = await convertRubToDisplay(
      toDecimal(row.amount.toString()),
      displayCurrency,
      row.fxRateDate,
    );
    hits.push({
      kind: "transaction",
      id: row.id,
      title: row.title,
      type: row.type,
      displayAmount: display.amount,
      displayCurrency: display.currency,
      originalAmount: row.originalAmount.toString(),
      inputCurrency: row.inputCurrency,
      occurredAt: row.occurredAt.toISOString(),
      transactionKind: row.kind,
      counterpartyName: row.counterparty?.name ?? null,
      categoryPaths: row.categories.map(
        (link) => pathById.get(link.category.id) ?? link.category.title,
      ),
      score: scoreOf(row),
    });
  }
  return hits.sort((a, b) => b.score - a.score);
}

function mergeTransactionHits(
  hits: SearchTransactionHit[],
  limit: number,
): SearchTransactionHit[] {
  const byId = new Map<string, SearchTransactionHit>();
  for (const hit of hits) {
    const existing = byId.get(hit.id);
    if (!existing || hit.score > existing.score) {
      byId.set(hit.id, hit);
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function sumRubRows(
  rows: Array<{ amount: { toString(): string }; fxRateDate: Date }>,
  displayCurrency: string,
) {
  let total = toDecimal(0);
  for (const row of rows) {
    const converted = await convertRubToDisplay(
      toDecimal(row.amount.toString()),
      displayCurrency,
      row.fxRateDate,
    );
    total = total.plus(toDecimal(converted.amount));
  }
  return total;
}

function textScore(haystack: string, needle: string): number {
  if (!needle) {
    return 0;
  }
  if (haystack === needle) {
    return 1;
  }
  if (haystack.startsWith(needle)) {
    return 0.95;
  }
  if (haystack.includes(`/${needle}`) || haystack.endsWith(`/${needle}`)) {
    return 0.9;
  }
  if (haystack.includes(needle)) {
    return 0.75;
  }
  // crude token overlap
  const parts = needle.split(/[\s/]+/).filter(Boolean);
  if (parts.length === 0) {
    return 0;
  }
  const matched = parts.filter((part) => haystack.includes(part)).length;
  if (matched === 0) {
    return 0;
  }
  return 0.4 + (matched / parts.length) * 0.3;
}
