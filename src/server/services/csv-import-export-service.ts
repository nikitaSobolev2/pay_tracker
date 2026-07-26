import { createHash, randomUUID } from "node:crypto";

import Papa from "papaparse";

import {
  joinCsvCategories,
  splitCsvCategories,
} from "@/lib/csv-categories";
import { AppServiceError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import {
  TransactionDebtRole,
  TransactionType,
} from "@/types/enums";

import { findOrCreateCategoryByPath, toCategoryDtos } from "./category-service";
import type {
  CsvApplyInput,
  CsvApplyResult,
  CsvExportResult,
  CsvImportRow,
  CsvPreviewResult,
  CsvPreviewRow,
} from "./csv-import-export-service.types";
import { CsvPreviewRowStatus } from "./csv-import-export-service.types";
import { createTransaction } from "./transaction-service";

const CSV_COLUMNS = [
  "id",
  "type",
  "amount",
  "inputCurrency",
  "originalAmount",
  "rateToRub",
  "fxRateDate",
  "title",
  "occurredAt",
  "debtRole",
  "counterparty",
  "categories",
  "createdAt",
] as const;

export async function exportCsv(userId: string): Promise<CsvExportResult> {
  const rows = await prisma.transaction.findMany({
    where: { userId, isDeleted: false },
    include: {
      counterparty: true,
      categories: { include: { category: true } },
    },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
  });

  const uniqueCategories = new Map(
    rows.flatMap((row) =>
      row.categories.map((link) => [link.category.id, link.category] as const),
    ),
  );
  const categoryDtos = await toCategoryDtos([...uniqueCategories.values()]);
  const pathByCategoryId = new Map(
    categoryDtos.map((dto) => [dto.id, dto.path]),
  );

  const data = rows.map((row) => ({
    id: row.id,
    type: row.type,
    amount: row.amount.toString(),
    inputCurrency: row.inputCurrency,
    originalAmount: row.originalAmount.toString(),
    rateToRub: row.rateToRub.toString(),
    fxRateDate: row.fxRateDate.toISOString().slice(0, 10),
    title: row.title ?? "",
    occurredAt: row.occurredAt.toISOString(),
    debtRole: row.debtRole ?? "",
    counterparty: row.counterparty?.name ?? "",
    categories: joinCsvCategories(
      row.categories.map(
        (link) =>
          pathByCategoryId.get(link.category.id) ?? link.category.title,
      ),
    ),
    createdAt: row.createdAt.toISOString(),
  }));

  return {
    filename: `paytracker-export-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: Papa.unparse(data, { columns: [...CSV_COLUMNS] }),
  };
}

export async function previewImport(
  userId: string,
  csvText: string,
): Promise<CsvPreviewResult> {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      parsed.errors[0]?.message ?? "Invalid CSV",
    );
  }

  const existing = await prisma.transaction.findMany({
    where: { userId, isDeleted: false },
    include: { counterparty: true },
  });
  const existingIds = new Set(existing.map((row) => row.id));
  const existingHashes = new Set(
    existing.map((row) =>
      buildDuplicateHash({
        type: row.type,
        originalAmount: row.originalAmount.toString(),
        inputCurrency: row.inputCurrency,
        occurredAt: row.occurredAt.toISOString(),
        title: row.title,
        debtRole: row.debtRole,
        counterparty: row.counterparty?.name ?? null,
      }),
    ),
  );

  const rows: CsvPreviewRow[] = parsed.data.map((raw, index) => {
    const errors: string[] = [];
    const row = parseImportRow(raw, errors);
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

    const hash = buildDuplicateHash(row);
    if (existingHashes.has(hash)) {
      return {
        index,
        status: CsvPreviewRowStatus.Duplicate,
        errors: [],
        duplicateReason: "Matching type/amount/currency/date/title/debt fields",
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

export async function applyImport(
  input: CsvApplyInput,
): Promise<CsvApplyResult> {
  const preview = await previewImport(
    input.userId,
    Papa.unparse(
      input.rows.map((row) => ({
        id: row.id ?? "",
        type: row.type,
        originalAmount: row.originalAmount,
        inputCurrency: row.inputCurrency,
        title: row.title ?? "",
        occurredAt: row.occurredAt,
        debtRole: row.debtRole ?? "",
        counterparty: row.counterparty ?? "",
        categories: joinCsvCategories(row.categories ?? []),
      })),
    ),
  );

  const errors: Array<{ index: number; message: string }> = [];
  let importedCount = 0;
  let skippedCount = 0;

  for (const previewRow of preview.rows) {
    if (previewRow.status === CsvPreviewRowStatus.Duplicate) {
      skippedCount += 1;
      continue;
    }
    if (
      previewRow.status === CsvPreviewRowStatus.Invalid ||
      !previewRow.row
    ) {
      errors.push({
        index: previewRow.index,
        message: previewRow.errors.join("; ") || "Invalid row",
      });
      continue;
    }

    try {
      const categoryIds = await resolveCategoryIds(
        input.userId,
        previewRow.row.type,
        previewRow.row.categories ?? [],
      );
      await createTransaction({
        userId: input.userId,
        displayCurrency: input.displayCurrency,
        type: previewRow.row.type,
        originalAmount: previewRow.row.originalAmount,
        inputCurrency: previewRow.row.inputCurrency,
        title: previewRow.row.title,
        occurredAt: new Date(previewRow.row.occurredAt),
        debtRole: previewRow.row.debtRole ?? null,
        counterpartyName: previewRow.row.counterparty ?? null,
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

  return { importedCount, skippedCount, errors };
}

function parseImportRow(
  raw: Record<string, string>,
  errors: string[],
): CsvImportRow | null {
  const typeRaw = (raw.type ?? "").trim().toUpperCase();
  if (
    typeRaw !== TransactionType.Spending &&
    typeRaw !== TransactionType.Earning
  ) {
    errors.push("Invalid type");
  }

  const originalAmount = (
    raw.originalAmount ||
    raw.amount ||
    ""
  ).trim();
  if (!originalAmount) {
    errors.push("Amount is required");
  }

  const inputCurrency = (raw.inputCurrency || "RUB").trim().toUpperCase();
  const occurredAt = (raw.occurredAt || "").trim();
  if (!occurredAt || Number.isNaN(Date.parse(occurredAt))) {
    errors.push("Invalid occurredAt");
  }

  const debtRoleRaw = (raw.debtRole || "").trim().toUpperCase();
  let debtRole: TransactionDebtRole | null = null;
  if (debtRoleRaw) {
    if (
      debtRoleRaw !== TransactionDebtRole.Lend &&
      debtRoleRaw !== TransactionDebtRole.Borrow
    ) {
      errors.push("Invalid debtRole");
    } else {
      debtRole = debtRoleRaw;
    }
  }

  if (errors.length > 0) {
    return null;
  }

  return {
    id: (raw.id || "").trim() || null,
    type: typeRaw as TransactionType,
    originalAmount,
    inputCurrency,
    title: (raw.title || "").trim() || null,
    occurredAt: new Date(occurredAt).toISOString(),
    debtRole,
    counterparty: (raw.counterparty || "").trim() || null,
    categories: splitCsvCategories(raw.categories || ""),
  };
}

function buildDuplicateHash(input: {
  type: TransactionType;
  originalAmount: string;
  inputCurrency: string;
  occurredAt: string;
  title?: string | null;
  debtRole?: TransactionDebtRole | null;
  counterparty?: string | null;
}): string {
  const payload = [
    input.type,
    input.originalAmount,
    input.inputCurrency.toUpperCase(),
    new Date(input.occurredAt).toISOString(),
    input.title ?? "",
    input.debtRole ?? "",
    input.counterparty ?? "",
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

async function resolveCategoryIds(
  userId: string,
  type: TransactionType,
  paths: string[],
): Promise<string[]> {
  if (paths.length === 0) {
    return [];
  }
  const ids: string[] = [];
  for (const path of paths) {
    const category = await findOrCreateCategoryByPath({
      userId,
      type,
      path,
    });
    ids.push(category.id);
  }
  return ids;
}
