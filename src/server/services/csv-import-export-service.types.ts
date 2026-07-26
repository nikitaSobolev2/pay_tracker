import type { TransactionKind, TransactionType } from "@/types/enums";

export type CsvExportResult = {
  filename: string;
  csv: string;
};

export const CsvPreviewRowStatus = {
  Valid: "valid",
  Invalid: "invalid",
  Duplicate: "duplicate",
} as const;
export type CsvPreviewRowStatus =
  (typeof CsvPreviewRowStatus)[keyof typeof CsvPreviewRowStatus];

export type CsvImportRow = {
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

export type CsvPreviewRow = {
  index: number;
  status: CsvPreviewRowStatus;
  errors: string[];
  duplicateReason?: string | null;
  row: CsvImportRow | null;
  raw: Record<string, string>;
};

export type CsvPreviewResult = {
  rows: CsvPreviewRow[];
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
};

export type CsvApplyInput = {
  userId: string;
  displayCurrency: string;
  rows: CsvImportRow[];
};

export type CsvApplyResult = {
  importedCount: number;
  skippedCount: number;
  errors: Array<{ index: number; message: string }>;
};
