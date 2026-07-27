import Papa from "papaparse";

export const CSV_EXPORT_MARKER = "#PAYTRACKER_EXPORT_V2";
export const CSV_SECTION_PREFIX = "#SECTION ";

export const CsvExportSection = {
  Categories: "categories",
  Counterparties: "counterparties",
  Transactions: "transactions",
  TransactionCategories: "transaction_categories",
} as const;

export type CsvExportSection =
  (typeof CsvExportSection)[keyof typeof CsvExportSection];

export const CATEGORY_COLUMNS = [
  "id",
  "title",
  "type",
  "parentCategoryId",
  "keywords",
  "createdAt",
] as const;

export const COUNTERPARTY_COLUMNS = ["id", "name", "createdAt"] as const;

export const TRANSACTION_COLUMNS = [
  "id",
  "type",
  "amount",
  "inputCurrency",
  "originalAmount",
  "rateToRub",
  "fxRateDate",
  "title",
  "occurredAt",
  "kind",
  "counterpartyId",
  "counterparty",
  "createdAt",
] as const;

export const TRANSACTION_CATEGORY_COLUMNS = [
  "transactionId",
  "categoryId",
] as const;

export type CsvSectionTables = {
  categories: Record<string, string>[];
  counterparties: Record<string, string>[];
  transactions: Record<string, string>[];
  transactionCategories: Record<string, string>[];
};

export function isPaytrackerExportV2(csvText: string): boolean {
  return csvText.trimStart().startsWith(CSV_EXPORT_MARKER);
}

export function buildSectionedCsv(sections: {
  categories: Record<string, string>[];
  counterparties: Record<string, string>[];
  transactions: Record<string, string>[];
  transactionCategories: Record<string, string>[];
}): string {
  const parts = [
    CSV_EXPORT_MARKER,
    "",
    `${CSV_SECTION_PREFIX}${CsvExportSection.Categories}`,
    Papa.unparse(sections.categories, { columns: [...CATEGORY_COLUMNS] }),
    "",
    `${CSV_SECTION_PREFIX}${CsvExportSection.Counterparties}`,
    Papa.unparse(sections.counterparties, {
      columns: [...COUNTERPARTY_COLUMNS],
    }),
    "",
    `${CSV_SECTION_PREFIX}${CsvExportSection.Transactions}`,
    Papa.unparse(sections.transactions, { columns: [...TRANSACTION_COLUMNS] }),
    "",
    `${CSV_SECTION_PREFIX}${CsvExportSection.TransactionCategories}`,
    Papa.unparse(sections.transactionCategories, {
      columns: [...TRANSACTION_CATEGORY_COLUMNS],
    }),
    "",
  ];
  return parts.join("\n");
}

export function parseSectionedCsv(csvText: string): CsvSectionTables {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/);
  const buckets = new Map<CsvExportSection, string[]>();
  let current: CsvExportSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === CSV_EXPORT_MARKER) {
      continue;
    }
    if (trimmed.startsWith(CSV_SECTION_PREFIX)) {
      const name = trimmed.slice(CSV_SECTION_PREFIX.length).trim();
      if (!isKnownSection(name)) {
        current = null;
        continue;
      }
      current = name;
      if (!buckets.has(current)) {
        buckets.set(current, []);
      }
      continue;
    }
    if (!current) {
      continue;
    }
    buckets.get(current)!.push(line);
  }

  return {
    categories: parseSectionRows(
      buckets.get(CsvExportSection.Categories) ?? [],
    ),
    counterparties: parseSectionRows(
      buckets.get(CsvExportSection.Counterparties) ?? [],
    ),
    transactions: parseSectionRows(
      buckets.get(CsvExportSection.Transactions) ?? [],
    ),
    transactionCategories: parseSectionRows(
      buckets.get(CsvExportSection.TransactionCategories) ?? [],
    ),
  };
}

function isKnownSection(name: string): name is CsvExportSection {
  return (Object.values(CsvExportSection) as string[]).includes(name);
}

function parseSectionRows(lines: string[]): Record<string, string>[] {
  if (lines.length === 0) {
    return [];
  }
  const parsed = Papa.parse<Record<string, string>>(lines.join("\n"), {
    header: true,
    skipEmptyLines: true,
  });
  return parsed.data.map((row) => normalizeRow(row));
}

function normalizeRow(row: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key.trim()] = typeof value === "string" ? value : String(value ?? "");
  }
  return result;
}

export function joinKeywords(keywords: string[]): string {
  return keywords.join(";");
}

export function splitKeywords(raw: string): string[] {
  return raw
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}
