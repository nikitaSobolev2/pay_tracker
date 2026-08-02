import { z } from "zod";

import { AppServiceError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api";
import {
  EventAiReportType,
  EventSpendingCategory,
  type EventSpendingCategory as SpendingCategory,
} from "@/types/enums";

export type ItemAnalysisSuggestion = {
  readonly itemId: string;
  readonly message: string;
  readonly betterAmount: number | null;
  readonly realisticPrice: number | null;
};

export type MissingItemSuggestion = {
  readonly title: string;
  readonly category: SpendingCategory;
  readonly amount: number;
  readonly amountUnit: string;
  readonly price: number;
  readonly reason: string;
};

export type StoredSuggestedItem = {
  readonly id: string;
  readonly title: string;
  readonly category: SpendingCategory;
  readonly amount: string;
  readonly amountUnit: string;
  readonly price: string;
  readonly reason: string;
  readonly addedAt: string | null;
};

export type ParsedEventAnalysis = {
  readonly type: EventAiReportType;
  readonly reportMessage: string;
  readonly items: readonly ItemAnalysisSuggestion[];
  readonly suggestedItems: readonly MissingItemSuggestion[];
};

const MAX_SUGGESTED_ITEMS = 8;

const SPENDING_CATEGORIES = new Set<string>(
  Object.values(EventSpendingCategory),
);

/** Models often emit amounts as strings, zeros, or blanks — coerce to null/number. */
const optionalPositiveNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value): number | null => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === "string" && value.trim() === "") {
      return null;
    }
    const numberValue = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      return null;
    }
    return numberValue;
  });

const requiredPositiveNumber = optionalPositiveNumber.refine(
  (value): value is number => value !== null,
);

const itemReportSchema = z.object({
  message: z.string().min(1).max(2000),
  better_amount: optionalPositiveNumber.optional().default(null),
  realistic_price: optionalPositiveNumber.optional().default(null),
});

const itemReportEntrySchema = itemReportSchema.extend({
  item_id: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
});

const suggestedItemSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().transform((value) => value.trim().toUpperCase()),
  amount: requiredPositiveNumber,
  amount_unit: z.string().min(1).max(40),
  realistic_price: requiredPositiveNumber,
  reason: z.string().min(1).max(1000),
});

const analysisSchema = z.object({
  event_report_type: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.enum(["ok", "bad"])),
  report_message: z.string().min(1).max(20_000),
  items_report: z
    .union([
      z.record(z.string(), itemReportSchema),
      z.array(itemReportEntrySchema),
      z.null(),
    ])
    .optional()
    .transform((value) => normalizeItemsReport(value)),
  suggested_items: z
    .union([z.array(z.unknown()), z.null()])
    .optional()
    .default([]),
});

/** Parses model JSON and drops suggestions for unknown spending ids. */
export function parseAnalysisResponse(
  content: string,
  knownItemIds: ReadonlySet<string>,
  knownItemTitles: ReadonlySet<string> = new Set(),
): ParsedEventAnalysis {
  const payload = parseJsonPayload(content);
  const parsed = analysisSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppServiceError(
      ApiErrorCode.Internal,
      "AI returned an unexpected report shape",
    );
  }

  const items = Object.entries(parsed.data.items_report)
    .filter(([itemId]) => knownItemIds.has(itemId))
    .map(([itemId, report]) => ({
      itemId,
      message: report.message.trim(),
      betterAmount: report.better_amount,
      realisticPrice: report.realistic_price,
    }))
    .filter(
      (item) =>
        item.message.length > 0 &&
        (item.betterAmount !== null || item.realisticPrice !== null),
    );

  return {
    type:
      parsed.data.event_report_type === "ok"
        ? EventAiReportType.Ok
        : EventAiReportType.Bad,
    reportMessage: parsed.data.report_message.trim(),
    items,
    suggestedItems: normalizeSuggestedItems(
      parsed.data.suggested_items ?? [],
      knownItemTitles,
    ),
  };
}

function normalizeSuggestedItems(
  rawItems: readonly unknown[],
  knownItemTitles: ReadonlySet<string>,
): MissingItemSuggestion[] {
  const knownTitles = [...knownItemTitles];
  const acceptedTitles: string[] = [];
  const suggestions: MissingItemSuggestion[] = [];

  for (const raw of rawItems) {
    if (suggestions.length >= MAX_SUGGESTED_ITEMS) {
      break;
    }
    const parsed = suggestedItemSchema.safeParse(raw);
    if (!parsed.success) {
      continue;
    }
    if (!SPENDING_CATEGORIES.has(parsed.data.category)) {
      continue;
    }

    const title = parsed.data.title.trim();
    if (
      !title ||
      isDuplicateSuggestionTitle(title, knownTitles) ||
      isDuplicateSuggestionTitle(title, acceptedTitles)
    ) {
      continue;
    }
    acceptedTitles.push(title);

    suggestions.push({
      title,
      category: parsed.data.category as SpendingCategory,
      amount: parsed.data.amount,
      amountUnit: parsed.data.amount_unit.trim(),
      price: parsed.data.realistic_price,
      reason: parsed.data.reason.trim(),
    });
  }

  return suggestions;
}

/** True when suggestion is the same product as an existing/accepted title. */
export function isDuplicateSuggestionTitle(
  candidate: string,
  knownTitles: readonly string[],
): boolean {
  const candidateNorm = normalizeTitle(candidate);
  if (!candidateNorm) {
    return true;
  }
  const candidateKeys = titleIdentityKeys(candidateNorm);

  for (const known of knownTitles) {
    const knownNorm = normalizeTitle(known);
    if (!knownNorm) {
      continue;
    }
    if (candidateNorm === knownNorm) {
      return true;
    }
    if (isTokenSubsetMatch(candidateNorm, knownNorm)) {
      return true;
    }
    const knownKeys = titleIdentityKeys(knownNorm);
    for (const key of candidateKeys) {
      if (knownKeys.has(key)) {
        return true;
      }
    }
  }

  return false;
}

function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLocaleLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Canonical keys for common en/ru party-supply synonyms so
 * "Disposable cups" and "одноразовые стаканы" collapse together.
 */
const TITLE_ALIAS_TO_CANONICAL: Readonly<Record<string, string>> = {
  cup: "cups",
  cups: "cups",
  "disposable cups": "cups",
  "plastic cups": "cups",
  "paper cups": "cups",
  стакан: "cups",
  стаканы: "cups",
  "одноразовые стаканы": "cups",
  "пластиковые стаканы": "cups",
  "бумажные стаканы": "cups",
  ice: "ice",
  "ice cubes": "ice",
  лед: "ice",
  "кубики льда": "ice",
  water: "water",
  "still water": "water",
  "sparkling water": "water",
  "drinking water": "water",
  вода: "water",
  "питьевая вода": "water",
  bread: "bread",
  хлеб: "bread",
  salt: "salt",
  соль: "salt",
  sugar: "sugar",
  сахар: "sugar",
  lemon: "lemon",
  лимон: "lemon",
  lemons: "lemon",
  лимоны: "lemon",
};

function titleIdentityKeys(normalizedTitle: string): Set<string> {
  const keys = new Set<string>([normalizedTitle]);
  const direct = TITLE_ALIAS_TO_CANONICAL[normalizedTitle];
  if (direct) {
    keys.add(direct);
  }
  for (const [alias, canonical] of Object.entries(TITLE_ALIAS_TO_CANONICAL)) {
    if (
      normalizedTitle === alias ||
      hasWholePhrase(normalizedTitle, alias) ||
      hasWholePhrase(alias, normalizedTitle)
    ) {
      keys.add(canonical);
    }
  }
  return keys;
}

function hasWholePhrase(haystack: string, needle: string): boolean {
  if (!needle || needle.length < 3) {
    return false;
  }
  if (haystack === needle) {
    return true;
  }
  return (
    haystack.startsWith(`${needle} `) ||
    haystack.endsWith(` ${needle}`) ||
    haystack.includes(` ${needle} `)
  );
}

function significantTokens(normalizedTitle: string): string[] {
  return normalizedTitle
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !TITLE_STOPWORDS.has(token));
}

const TITLE_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "для",
  "и",
  "или",
]);

/** "cups" matches "disposable cups"; short 1-token titles need exact token equality. */
function isTokenSubsetMatch(left: string, right: string): boolean {
  const leftTokens = significantTokens(left);
  const rightTokens = significantTokens(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }
  const [shorter, longer] =
    leftTokens.length <= rightTokens.length
      ? [leftTokens, rightTokens]
      : [rightTokens, leftTokens];
  if (shorter.length === 1 && (shorter[0]?.length ?? 0) < 4) {
    return longer.length === 1 && longer[0] === shorter[0];
  }
  const longerSet = new Set(longer);
  return shorter.every((token) => longerSet.has(token));
}

/** Assigns stable ids when persisting a fresh analyze run. */
export function toStoredSuggestedItems(
  items: readonly MissingItemSuggestion[],
  createId: () => string,
): StoredSuggestedItem[] {
  return items.map((item) => ({
    id: createId(),
    title: item.title,
    category: item.category,
    amount: String(item.amount),
    amountUnit: item.amountUnit,
    price: String(item.price),
    reason: item.reason,
    addedAt: null,
  }));
}

/** Reads persisted JSON into typed suggestion rows; drops malformed entries. */
export function parseStoredSuggestedItems(
  value: unknown,
): StoredSuggestedItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    const item = readStoredSuggestedItem(entry);
    return item ? [item] : [];
  });
}

function readStoredSuggestedItem(entry: unknown): StoredSuggestedItem | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const row = entry as Record<string, unknown>;
  const id = asNonEmptyString(row.id);
  const title = asNonEmptyString(row.title);
  const categoryRaw = asNonEmptyString(row.category)?.toUpperCase() ?? "";
  const amount = asNonEmptyString(row.amount);
  const amountUnit = asNonEmptyString(row.amountUnit);
  const price = asNonEmptyString(row.price);
  const reason = asNonEmptyString(row.reason);
  if (
    !id ||
    !title ||
    !SPENDING_CATEGORIES.has(categoryRaw) ||
    !amount ||
    !amountUnit ||
    !price ||
    !reason
  ) {
    return null;
  }
  return {
    id,
    title,
    category: categoryRaw as SpendingCategory,
    amount,
    amountUnit,
    price,
    reason,
    addedAt: typeof row.addedAt === "string" ? row.addedAt : null,
  };
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseJsonPayload(content: string): unknown {
  const candidates = [content.trim(), extractJsonCandidate(content)].filter(
    (value): value is string => Boolean(value),
  );

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (typeof parsed === "string") {
        // Some providers double-encode the object as a JSON string.
        return JSON.parse(parsed);
      }
      return parsed;
    } catch {
      // Try the next candidate.
    }
  }

  throw new AppServiceError(ApiErrorCode.Internal, "AI returned invalid JSON");
}

function extractJsonCandidate(content: string): string | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return content.slice(start, end + 1);
  }
  return null;
}

function normalizeItemsReport(
  value:
    | Record<string, z.infer<typeof itemReportSchema>>
    | Array<z.infer<typeof itemReportEntrySchema>>
    | null
    | undefined,
): Record<string, z.infer<typeof itemReportSchema>> {
  if (!value) {
    return {};
  }
  if (!Array.isArray(value)) {
    return value;
  }

  const items: Record<string, z.infer<typeof itemReportSchema>> = {};
  for (const entry of value) {
    const itemId = entry.item_id ?? entry.id;
    if (!itemId) {
      continue;
    }
    items[itemId] = {
      message: entry.message,
      better_amount: entry.better_amount,
      realistic_price: entry.realistic_price,
    };
  }
  return items;
}
