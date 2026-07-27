import { createHash } from "node:crypto";

import {
  joinCsvCategories,
  splitCsvCategories,
} from "@/lib/csv-categories";
import { TransactionKind, TransactionType } from "@/types/enums";

export type ParsedCsvTransactionRow = {
  id?: string | null;
  type: TransactionType;
  originalAmount: string;
  inputCurrency: string;
  title?: string | null;
  occurredAt: string;
  kind: TransactionKind;
  counterparty?: string | null;
  categories?: string[];
};

const VALID_KINDS = new Set<string>(Object.values(TransactionKind));

export function resolveCsvTransactionKind(
  raw: Record<string, string>,
  errors: string[],
): TransactionKind {
  const kindRaw = (raw.kind || "").trim().toUpperCase();
  if (!kindRaw) {
    return TransactionKind.Default;
  }
  if (!VALID_KINDS.has(kindRaw)) {
    errors.push("Invalid kind");
    return TransactionKind.Default;
  }
  return kindRaw as TransactionKind;
}

export function parseCsvImportRow(
  raw: Record<string, string>,
  errors: string[],
): ParsedCsvTransactionRow | null {
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

  const kind = resolveCsvTransactionKind(raw, errors);

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
    kind,
    counterparty: (raw.counterparty || "").trim() || null,
    categories: splitCsvCategories(raw.categories || ""),
  };
}

export function buildCsvDuplicateHash(input: {
  type: TransactionType;
  originalAmount: string;
  inputCurrency: string;
  occurredAt: string;
  title?: string | null;
  kind: TransactionKind;
  counterparty?: string | null;
  categories?: string[];
}): string {
  const categories = joinCsvCategories(
    [...(input.categories ?? [])].sort((a, b) => a.localeCompare(b)),
  );
  const payload = [
    input.type,
    input.originalAmount,
    input.inputCurrency.toUpperCase(),
    new Date(input.occurredAt).toISOString(),
    input.title ?? "",
    input.kind,
    input.counterparty ?? "",
    categories,
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}
