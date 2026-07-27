import type { ParsedCsvTransactionRow } from "@/lib/csv-transaction-row";

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

export type CsvImportRow = ParsedCsvTransactionRow;

export type CsvPreviewRow = {
  index: number;
  status: CsvPreviewRowStatus;
  errors: string[];
  duplicateReason?: string | null;
  row: CsvImportRow | null;
  raw: Record<string, string>;
};

export type CsvPreviewResult = {
  catalog: {
    categories: number;
    counterparties: number;
    links: number;
  };
  rows: CsvPreviewRow[];
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
};

export type CsvApplyInput = {
  userId: string;
  displayCurrency: string;
  csvText: string;
};

export type CsvApplyResult = {
  importedCount: number;
  skippedCount: number;
  categoriesImported: number;
  counterpartiesImported: number;
  errors: Array<{ index: number; message: string }>;
};
