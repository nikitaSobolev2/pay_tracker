import { normalizeAmountRaw } from "@/lib/amount-input";

const DEFAULT_LIMIT = 8;

export function uniqueRecentAmounts(
  amounts: readonly string[],
  limit = DEFAULT_LIMIT,
): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const amount of amounts) {
    const normalized = normalizeAmountRaw(amount);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(normalized);
    if (unique.length >= limit) {
      break;
    }
  }
  return unique;
}
