import type Decimal from "decimal.js";

import {
  isCashflowExcludedKind,
  TransactionKind,
  TransactionType,
} from "@/types/enums";

/** Default cashflow: exclude own-account transfers only. */
export function includeRowInDefaultCashflow(kind: TransactionKind): boolean {
  return !isCashflowExcludedKind(kind);
}

/**
 * When the UI filters to a single kind, include that kind even if it is
 * normally excluded from cashflow (e.g. TRANSFER-only filter).
 */
export function includeRowInCashflow(
  kind: TransactionKind,
  kindsFilter?: readonly TransactionKind[],
): boolean {
  if (kindsFilter?.length === 1 && kindsFilter[0] === kind) {
    return true;
  }
  return includeRowInDefaultCashflow(kind);
}

/** Refunds reduce spending category totals (refunded purchase). */
export function categoryAttributionType(row: {
  type: TransactionType;
  kind: TransactionKind;
}): TransactionType {
  if (row.kind === TransactionKind.Refund) {
    return TransactionType.Spending;
  }
  return row.type;
}

/** Signed amount for category buckets: refunds subtract (unless kind-scoped to refund). */
export function categorySignedAmount(
  row: { kind: TransactionKind },
  amount: Decimal,
  kindsFilter?: readonly TransactionKind[],
): Decimal {
  if (row.kind !== TransactionKind.Refund) {
    return amount;
  }
  if (
    isSingleKindFilter(kindsFilter) &&
    kindsFilter[0] === TransactionKind.Refund
  ) {
    return amount;
  }
  return amount.neg();
}

/**
 * Cashflow series placement for timeline/heatmap/totals:
 * refunds attribute to spending and sign negative unless refund-scoped.
 */
export function attributeCashflowAmount(
  row: { type: TransactionType; kind: TransactionKind },
  amount: Decimal,
  kindsFilter?: readonly TransactionKind[],
): { type: TransactionType; amount: Decimal } {
  return {
    type: categoryAttributionType(row),
    amount: categorySignedAmount(row, amount, kindsFilter),
  };
}

export function isSingleKindFilter(
  kinds: readonly TransactionKind[] | undefined,
): kinds is readonly [TransactionKind] {
  return (kinds?.length ?? 0) === 1;
}
