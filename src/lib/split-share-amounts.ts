import Decimal from "decimal.js";

import { toDecimal } from "@/lib/money";

export function parseShareAmount(raw: string): Decimal | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const amount = toDecimal(trimmed);
    if (!amount.isFinite() || amount.lte(0)) {
      return null;
    }
    return amount;
  } catch {
    return null;
  }
}

export function emptySharePlaceholder(
  totalRaw: string,
  customAmounts: readonly string[],
): string {
  const allocation = allocateSplitShareAmounts(totalRaw, customAmounts);
  if (allocation.emptyCount === 0 || allocation.placeholder.lte(0)) {
    return "";
  }
  return formatIntegerShare(allocation.placeholder);
}

export function allocateSplitShareAmounts(
  totalRaw: string,
  customAmounts: readonly string[],
): {
  readonly placeholder: Decimal;
  readonly emptyCount: number;
  readonly customSum: Decimal;
  readonly remaining: Decimal;
  readonly resolved: string[];
  readonly isOverTotal: boolean;
  readonly hasInvalidCustom: boolean;
} {
  const total = toDecimal(totalRaw);
  const parsed = customAmounts.map((raw) => parseShareAmount(raw));
  const hasInvalidCustom = customAmounts.some(
    (raw, index) => raw.trim().length > 0 && parsed[index] == null,
  );
  const customSum = sumParsedAmounts(parsed);
  const emptyIndexes = emptyShareIndexes(parsed, customAmounts);
  const emptyCount = emptyIndexes.length;
  const remaining = total.minus(customSum);
  const isOverTotal = exceedsCeilIntegerSlack(
    total,
    customSum,
    customAmounts.length,
  );
  const placeholder = integerPlaceholder(remaining, emptyCount);
  const resolved = resolveShareAmounts(parsed, customAmounts, emptyIndexes, placeholder);

  return {
    placeholder,
    emptyCount,
    customSum,
    remaining,
    resolved,
    isOverTotal,
    hasInvalidCustom,
  };
}

export function canAcceptSplitShares(
  totalRaw: string,
  customAmounts: readonly string[],
): boolean {
  if (customAmounts.length === 0) {
    return false;
  }
  const allocation = allocateSplitShareAmounts(totalRaw, customAmounts);
  if (allocation.hasInvalidCustom || allocation.isOverTotal) {
    return false;
  }
  return allocation.resolved.every((amount) => parseShareAmount(amount) != null);
}

export function exceedsCeilIntegerSlack(
  parent: Decimal,
  sum: Decimal,
  shareCount: number,
): boolean {
  if (sum.lte(parent)) {
    return false;
  }
  return sum.minus(parent).gte(shareCount);
}

function sumParsedAmounts(parsed: readonly (Decimal | null)[]): Decimal {
  let customSum = toDecimal(0);
  for (const amount of parsed) {
    if (amount) {
      customSum = customSum.plus(amount);
    }
  }
  return customSum;
}

function emptyShareIndexes(
  parsed: readonly (Decimal | null)[],
  customAmounts: readonly string[],
): number[] {
  return parsed
    .map((amount, index) =>
      amount == null && !customAmounts[index]?.trim() ? index : -1,
    )
    .filter((index) => index >= 0);
}

function integerPlaceholder(remaining: Decimal, emptyCount: number): Decimal {
  if (emptyCount === 0 || remaining.lte(0)) {
    return toDecimal(0);
  }
  return remaining.div(emptyCount).toDecimalPlaces(0, Decimal.ROUND_CEIL);
}

function resolveShareAmounts(
  parsed: readonly (Decimal | null)[],
  customAmounts: readonly string[],
  emptyIndexes: readonly number[],
  placeholder: Decimal,
): string[] {
  const resolved = parsed.map((amount, index) => {
    if (amount) {
      return formatIntegerShare(amount);
    }
    if (customAmounts[index]?.trim()) {
      return "";
    }
    return "";
  });
  if (placeholder.lte(0)) {
    return resolved;
  }
  const share = formatIntegerShare(placeholder);
  for (const index of emptyIndexes) {
    resolved[index] = share;
  }
  return resolved;
}

function formatIntegerShare(amount: Decimal): string {
  return amount.toDecimalPlaces(0, Decimal.ROUND_CEIL).toFixed(0);
}
