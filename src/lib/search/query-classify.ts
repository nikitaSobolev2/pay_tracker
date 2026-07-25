import {
  parseSearchDateQuery,
  type ParsedDateRange,
} from "@/lib/search/date-query";

export type SearchQueryKind = "date" | "amount" | "text";

export type ClassifiedSearchQuery =
  | {
      kind: "date";
      raw: string;
      range: ParsedDateRange;
    }
  | {
      kind: "amount";
      raw: string;
      /** Digits-only normalized amount prefix/needle (may include decimal point). */
      amountNeedle: string;
      digitCount: number;
    }
  | {
      kind: "text";
      raw: string;
      normalized: string;
    };

export function normalizeAmountNeedle(raw: string): {
  needle: string;
  digitCount: number;
} | null {
  const cleaned = raw.trim().replace(/\s+/g, "").replace(",", ".");
  // One optional decimal only — reject dotted dates like 25.07.2024.
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length <= 3) {
    return null;
  }
  return { needle: cleaned, digitCount: digits.length };
}

export function classifySearchQuery(
  raw: string,
  timezone: string,
): ClassifiedSearchQuery | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  // Dates before amounts so 25.07.2024 / 2024 / July 2024 are not treated as money.
  const range = parseSearchDateQuery(trimmed, timezone);
  if (range) {
    return { kind: "date", raw: trimmed, range };
  }

  const amount = normalizeAmountNeedle(trimmed);
  if (amount) {
    return {
      kind: "amount",
      raw: trimmed,
      amountNeedle: amount.needle,
      digitCount: amount.digitCount,
    };
  }

  return {
    kind: "text",
    raw: trimmed,
    normalized: trimmed.toLowerCase(),
  };
}
