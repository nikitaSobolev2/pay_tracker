import { toDecimal } from "@/lib/money";
import { TransactionKind } from "@/types/enums";

const DIVISIBLE_KINDS: readonly TransactionKind[] = [
  TransactionKind.Default,
  TransactionKind.Refund,
];

export function canDivideTransaction(item: {
  readonly kind: TransactionKind;
  readonly sourceTransactionId: string | null;
  readonly originalAmount: string;
}): boolean {
  if (item.sourceTransactionId) {
    return false;
  }
  if (!DIVISIBLE_KINDS.includes(item.kind)) {
    return false;
  }
  try {
    return toDecimal(item.originalAmount).gt(0);
  } catch {
    return false;
  }
}
