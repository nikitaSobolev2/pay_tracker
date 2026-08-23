import { randomUUID } from "node:crypto";

import {
  buildSectionedCsv,
  isPaytrackerExportV2,
  joinKeywords,
  parseSectionedCsv,
  splitKeywords,
} from "@/lib/csv-export-format";
import { joinCsvCategories } from "@/lib/csv-categories";
import {
  buildCsvDuplicateHash,
  parseCsvImportRow,
} from "@/lib/csv-transaction-row";
import { AppServiceError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import { TransactionType } from "@/types/enums";
import type { TransactionType as TransactionTypeValue } from "@/types/enums";

import { toCategoryDtos } from "./category-service";
import { findOrCreateCounterparty } from "./counterparty-service";
import type {
  CsvApplyInput,
  CsvApplyResult,
  CsvExportResult,
  CsvPreviewResult,
  CsvPreviewRow,
} from "./csv-import-export-service.types";
import { CsvPreviewRowStatus } from "./csv-import-export-service.types";
import { createTransaction } from "./transaction-service";

export async function exportCsv(userId: string): Promise<CsvExportResult> {
  const [categories, counterparties, transactions, links] = await Promise.all([
    prisma.userCategory.findMany({
      where: { userId },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }, { title: "asc" }],
    }),
    prisma.userCounterparty.findMany({
      where: { userId },
      orderBy: [{ name: "asc" }],
    }),
    prisma.transaction.findMany({
      where: { userId, isDeleted: false },
      include: { counterparty: true },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.transactionCategory.findMany({
      where: { transaction: { userId, isDeleted: false } },
      orderBy: [{ transactionId: "asc" }, { categoryId: "asc" }],
    }),
  ]);

  const csv = buildSectionedCsv({
    categories: categories.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      parentCategoryId: row.parentCategoryId ?? "",
      keywords: joinKeywords(row.keywords ?? []),
      createdAt: row.createdAt.toISOString(),
    })),
    counterparties: counterparties.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
    })),
    transactions: transactions
      .filter((row) => row.sourceTransactionId == null)
      .map((row) => ({
      id: row.id,
      type: row.type,
      amount: row.amount.toString(),
      inputCurrency: row.inputCurrency,
      originalAmount: row.originalAmount.toString(),
      rateToRub: row.rateToRub.toString(),
      fxRateDate: row.fxRateDate.toISOString().slice(0, 10),
      title: row.title ?? "",
      occurredAt: row.occurredAt.toISOString(),
      kind: row.kind,
      counterpartyId: row.counterpartyId ?? "",
      counterparty: row.counterparty?.name ?? "",
      createdAt: row.createdAt.toISOString(),
    })),
    transactionCategories: links.map((row) => ({
      transactionId: row.transactionId,
      categoryId: row.categoryId,
    })),
  });

  return {
    filename: `paytracker-export-${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
  };
}

export async function previewImport(
  userId: string,
  csvText: string,
): Promise<CsvPreviewResult> {
  assertPaytrackerExport(csvText);
  const tables = parseSectionedCsv(csvText);
  const transactionRows = tables.transactions.map((row) => {
    const linkedCategoryIds = tables.transactionCategories
      .filter((link) => link.transactionId === row.id)
      .map((link) => link.categoryId);
    const categoryPaths = linkedCategoryIds
      .map((categoryId) => buildCategoryPath(tables.categories, categoryId))
      .filter(Boolean);
    return {
      ...row,
      categories: joinCsvCategories(categoryPaths),
      counterparty:
        row.counterparty ||
        tables.counterparties.find((item) => item.id === row.counterpartyId)
          ?.name ||
        "",
    };
  });

  const preview = await previewTransactionRows(userId, transactionRows);
  return {
    ...preview,
    catalog: {
      categories: tables.categories.length,
      counterparties: tables.counterparties.length,
      links: tables.transactionCategories.length,
    },
  };
}

export async function applyImport(
  input: CsvApplyInput,
): Promise<CsvApplyResult> {
  assertPaytrackerExport(input.csvText);
  const tables = parseSectionedCsv(input.csvText);
  const errors: Array<{ index: number; message: string }> = [];
  let importedCount = 0;
  let skippedCount = 0;
  let categoriesImported = 0;
  let counterpartiesImported = 0;

  const categoryIdMap = new Map<string, string>();
  try {
    categoriesImported = await importCategories(
      input.userId,
      tables.categories,
      categoryIdMap,
    );
  } catch (error) {
    errors.push({
      index: -1,
      message:
        error instanceof Error
          ? `Categories: ${error.message}`
          : "Category import failed",
    });
  }

  const counterpartyIdMap = new Map<string, string>();
  try {
    counterpartiesImported = await importCounterparties(
      input.userId,
      tables.counterparties,
      counterpartyIdMap,
    );
  } catch (error) {
    errors.push({
      index: -1,
      message:
        error instanceof Error
          ? `Counterparties: ${error.message}`
          : "Counterparty import failed",
    });
  }

  const linksByTransaction = new Map<string, string[]>();
  for (const link of tables.transactionCategories) {
    const transactionId = (link.transactionId || "").trim();
    const categoryId = (link.categoryId || "").trim();
    if (!transactionId || !categoryId) {
      continue;
    }
    const list = linksByTransaction.get(transactionId) ?? [];
    list.push(categoryId);
    linksByTransaction.set(transactionId, list);
  }

  const preview = await previewImport(input.userId, input.csvText);
  for (const previewRow of preview.rows) {
    if (previewRow.status === CsvPreviewRowStatus.Duplicate) {
      skippedCount += 1;
      continue;
    }
    if (previewRow.status === CsvPreviewRowStatus.Invalid || !previewRow.row) {
      errors.push({
        index: previewRow.index,
        message: previewRow.errors.join("; ") || "Invalid row",
      });
      continue;
    }

    try {
      const sourceId = previewRow.row.id ?? "";
      const linkedSourceCategoryIds = linksByTransaction.get(sourceId) ?? [];
      const categoryIds = linkedSourceCategoryIds
        .map((id) => categoryIdMap.get(id))
        .filter((id): id is string => Boolean(id));

      let counterpartyName = previewRow.row.counterparty ?? null;
      const sourceCounterpartyId = (
        previewRow.raw.counterpartyId || ""
      ).trim();
      if (!counterpartyName && sourceCounterpartyId) {
        const mappedId = counterpartyIdMap.get(sourceCounterpartyId);
        if (mappedId) {
          const party = await prisma.userCounterparty.findFirst({
            where: { id: mappedId, userId: input.userId },
            select: { name: true },
          });
          counterpartyName = party?.name ?? null;
        }
      }

      await createTransaction({
        userId: input.userId,
        displayCurrency: input.displayCurrency,
        type: previewRow.row.type,
        originalAmount: previewRow.row.originalAmount,
        inputCurrency: previewRow.row.inputCurrency,
        title: previewRow.row.title,
        occurredAt: new Date(previewRow.row.occurredAt),
        kind: previewRow.row.kind,
        counterpartyName,
        categoryIds,
        idempotencyKey: `import-${randomUUID()}`,
      });
      importedCount += 1;
    } catch (error) {
      errors.push({
        index: previewRow.index,
        message: error instanceof Error ? error.message : "Import failed",
      });
    }
  }

  return {
    importedCount,
    skippedCount,
    categoriesImported,
    counterpartiesImported,
    errors,
  };
}

function assertPaytrackerExport(csvText: string): void {
  if (!isPaytrackerExportV2(csvText)) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Invalid export file. Use a Pay Tracker export CSV.",
    );
  }
}

async function previewTransactionRows(
  userId: string,
  rawRows: Record<string, string>[],
): Promise<Omit<CsvPreviewResult, "catalog">> {
  const existing = await prisma.transaction.findMany({
    where: { userId, isDeleted: false },
    include: {
      counterparty: true,
      categories: { include: { category: true } },
    },
  });
  const pathByCategoryId = await buildPathByCategoryId(
    existing.flatMap((row) => row.categories.map((link) => link.category)),
  );

  const existingIds = new Set(existing.map((row) => row.id));
  const existingHashes = new Set(
    existing.map((row) =>
      buildCsvDuplicateHash({
        type: row.type,
        originalAmount: row.originalAmount.toString(),
        inputCurrency: row.inputCurrency,
        occurredAt: row.occurredAt.toISOString(),
        title: row.title,
        kind: row.kind,
        counterparty: row.counterparty?.name ?? null,
        categories: row.categories.map(
          (link) =>
            pathByCategoryId.get(link.category.id) ?? link.category.title,
        ),
      }),
    ),
  );

  const rows: CsvPreviewRow[] = rawRows.map((raw, index) => {
    const errors: string[] = [];
    const row = parseCsvImportRow(raw, errors);
    if (!row || errors.length > 0) {
      return {
        index,
        status: CsvPreviewRowStatus.Invalid,
        errors,
        duplicateReason: null,
        row,
        raw,
      };
    }

    if (row.id && existingIds.has(row.id)) {
      return {
        index,
        status: CsvPreviewRowStatus.Duplicate,
        errors: [],
        duplicateReason: "Matching transaction id",
        row,
        raw,
      };
    }

    const hash = buildCsvDuplicateHash(row);
    if (existingHashes.has(hash)) {
      return {
        index,
        status: CsvPreviewRowStatus.Duplicate,
        errors: [],
        duplicateReason:
          "Matching type/amount/currency/date/title/kind/categories",
        row,
        raw,
      };
    }

    return {
      index,
      status: CsvPreviewRowStatus.Valid,
      errors: [],
      duplicateReason: null,
      row,
      raw,
    };
  });

  return {
    rows,
    validCount: rows.filter((row) => row.status === CsvPreviewRowStatus.Valid)
      .length,
    invalidCount: rows.filter(
      (row) => row.status === CsvPreviewRowStatus.Invalid,
    ).length,
    duplicateCount: rows.filter(
      (row) => row.status === CsvPreviewRowStatus.Duplicate,
    ).length,
  };
}

async function importCategories(
  userId: string,
  rows: Record<string, string>[],
  idMap: Map<string, string>,
): Promise<number> {
  const pending = rows
    .map((row) => ({
      sourceId: (row.id || "").trim(),
      title: (row.title || "").trim(),
      type: (row.type || "").trim().toUpperCase() as TransactionTypeValue,
      parentSourceId: (row.parentCategoryId || "").trim() || null,
      keywords: splitKeywords(row.keywords || ""),
    }))
    .filter((row) => row.sourceId && row.title);

  let imported = 0;
  let guard = pending.length + 1;
  while (pending.length > 0 && guard > 0) {
    guard -= 1;
    let progress = false;
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const row = pending[index]!;
      if (
        row.type !== TransactionType.Spending &&
        row.type !== TransactionType.Earning
      ) {
        pending.splice(index, 1);
        continue;
      }
      if (row.parentSourceId && !idMap.has(row.parentSourceId)) {
        const parentStillPending = pending.some(
          (item) => item.sourceId === row.parentSourceId,
        );
        if (parentStillPending) {
          continue;
        }
      }
      const parentCategoryId = row.parentSourceId
        ? (idMap.get(row.parentSourceId) ?? null)
        : null;
      const created = await findOrCreateCategoryNode({
        userId,
        title: row.title,
        type: row.type,
        parentCategoryId,
        keywords: row.keywords,
      });
      idMap.set(row.sourceId, created.id);
      pending.splice(index, 1);
      imported += 1;
      progress = true;
    }
    if (!progress) {
      break;
    }
  }
  return imported;
}

async function importCounterparties(
  userId: string,
  rows: Record<string, string>[],
  idMap: Map<string, string>,
): Promise<number> {
  let imported = 0;
  for (const row of rows) {
    const sourceId = (row.id || "").trim();
    const name = (row.name || "").trim();
    if (!sourceId || !name) {
      continue;
    }
    const party = await findOrCreateCounterparty({ userId, name });
    idMap.set(sourceId, party.id);
    imported += 1;
  }
  return imported;
}

async function findOrCreateCategoryNode(input: {
  userId: string;
  title: string;
  type: TransactionTypeValue;
  parentCategoryId: string | null;
  keywords: string[];
}): Promise<{ id: string }> {
  const existing = await prisma.userCategory.findFirst({
    where: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      parentCategoryId: input.parentCategoryId,
    },
    select: { id: true, keywords: true },
  });
  if (existing) {
    if (
      input.keywords.length > 0 &&
      JSON.stringify([...(existing.keywords ?? [])].sort()) !==
        JSON.stringify([...input.keywords].sort())
    ) {
      await prisma.userCategory.update({
        where: { id: existing.id },
        data: { keywords: input.keywords },
      });
    }
    return existing;
  }
  return prisma.userCategory.create({
    data: {
      userId: input.userId,
      title: input.title,
      type: input.type,
      parentCategoryId: input.parentCategoryId,
      keywords: input.keywords,
    },
    select: { id: true },
  });
}

async function buildPathByCategoryId(
  categories: Array<{
    id: string;
    title: string;
    type: TransactionTypeValue;
    parentCategoryId: string | null;
  }>,
): Promise<Map<string, string>> {
  const unique = new Map(categories.map((row) => [row.id, row]));
  const dtos = await toCategoryDtos([...unique.values()]);
  return new Map(dtos.map((dto) => [dto.id, dto.path]));
}

function buildCategoryPath(
  categories: Record<string, string>[],
  categoryId: string,
): string {
  const byId = new Map(
    categories.map((row) => [(row.id || "").trim(), row] as const),
  );
  const segments: string[] = [];
  let current = byId.get(categoryId);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    segments.unshift((current.title || "").trim());
    const parentId = (current.parentCategoryId || "").trim();
    current = parentId ? byId.get(parentId) : undefined;
  }
  return segments.filter(Boolean).join("/");
}
