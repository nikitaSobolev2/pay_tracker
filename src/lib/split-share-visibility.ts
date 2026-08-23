import { isDebtLedgerKind } from "@/lib/debt-episodes";
import type { TransactionKind } from "@/types/enums";

export function shouldIncludeSplitSharesInList(input: {
  readonly kinds?: readonly TransactionKind[];
  readonly counterpartyIds?: readonly string[];
}): boolean {
  if (input.counterpartyIds && input.counterpartyIds.length > 0) {
    return true;
  }
  return Boolean(input.kinds?.some((kind) => isDebtLedgerKind(kind)));
}
