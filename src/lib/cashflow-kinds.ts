import type Decimal from "decimal.js";

import {
  isCashflowExcludedKind,
  TransactionKind,
  TransactionType,
} from "@/types/enums";

export function isSplitShareRow(
  sourceTransactionId?: string | null,
): boolean {
  return Boolean(sourceTransactionId);
}

/** Default cashflow: exclude transfers, forgive write-offs, and split IOUs. */
export function includeRowInDefaultCashflow(
  kind: TransactionKind,
  sourceTransactionId?: string | null,
): boolean {
  if (isSplitShareRow(sourceTransactionId)) {
    return false;
  }
  return !isCashflowExcludedKind(kind);
}

/**
 * When the UI filters to a single kind, include that kind even if it is
 * normally excluded from cashflow (e.g. TRANSFER-only filter).
 * Split-share rows stay excluded — they are IOUs, not a second cash move.
 */
export function includeRowInCashflow(
  kind: TransactionKind,
  kindsFilter?: readonly TransactionKind[],
  sourceTransactionId?: string | null,
): boolean {
  if (isSplitShareRow(sourceTransactionId)) {
    return false;
  }
  if (kindsFilter?.length === 1 && kindsFilter[0] === kind) {
    return true;
  }
  return includeRowInDefaultCashflow(kind, sourceTransactionId);
}

/** Category charts follow the transaction's own type. */
export function categoryAttributionType(row: {
  type: TransactionType;
}): TransactionType {
  return row.type;
}

/** Signed amount for category buckets — magnitude stays as stored. */
export function categorySignedAmount(amount: Decimal): Decimal {
  return amount;
}

/** Cashflow series placement for timeline/heatmap/totals. */
export function attributeCashflowAmount(
  row: { type: TransactionType },
  amount: Decimal,
): { type: TransactionType; amount: Decimal } {
  return {
    type: categoryAttributionType(row),
    amount: categorySignedAmount(amount),
  };
}

export function isSingleKindFilter(
  kinds: readonly TransactionKind[] | undefined,
): kinds is readonly [TransactionKind] {
  return (kinds?.length ?? 0) === 1;
}
