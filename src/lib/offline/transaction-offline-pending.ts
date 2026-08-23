import type { TransactionOfflineQueueItem } from "@/stores/transaction-offline-queue.types";
import {
  FastQueueStatus,
  TransactionKind,
  TransactionType,
} from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

export function isPendingOfflineQueueStatus(
  status: FastQueueStatus,
): boolean {
  return (
    status === FastQueueStatus.Pending || status === FastQueueStatus.Error
  );
}

export function transactionDtoFromOfflineCreate(
  item: TransactionOfflineQueueItem,
): TransactionDto {
  const { body, localId, createdAtLocal } = item;
  const occurredAt = body.occurredAt;
  const fxRateDate = occurredAt.slice(0, 10);
  return {
    id: `local:${localId}`,
    type: body.type,
    amount: body.originalAmount,
    inputCurrency: body.inputCurrency,
    originalAmount: body.originalAmount,
    rateToRub: "1",
    fxRateDate,
    displayAmount: body.originalAmount,
    displayCurrency: body.inputCurrency,
    title: body.title ?? null,
    occurredAt,
    kind: body.kind ?? TransactionKind.Default,
    counterpartyId: null,
    counterpartyName: body.counterpartyName ?? null,
    travelId: body.travelId ?? null,
    sourceTransactionId: null,
    splitShares: [],
    splitHasLaterDebtEvents: false,
    categories: [],
    createdAt: createdAtLocal,
    updatedAt: createdAtLocal,
  };
}

export function pendingOfflineCreateDtos(
  items: readonly TransactionOfflineQueueItem[],
): TransactionDto[] {
  return items
    .filter((item) => isPendingOfflineQueueStatus(item.status))
    .map(transactionDtoFromOfflineCreate);
}

export type PendingTransactionMatch = {
  readonly type?: TransactionType;
  readonly travelId?: string | null;
};

export function mergePendingOfflineTransactions(
  serverItems: readonly TransactionDto[],
  pendingItems: readonly TransactionOfflineQueueItem[],
  match: PendingTransactionMatch = {},
): TransactionDto[] {
  const pending = pendingOfflineCreateDtos(pendingItems).filter((item) => {
    if (match.type != null && item.type !== match.type) {
      return false;
    }
    if (match.travelId !== undefined) {
      if (match.travelId === null) {
        if (item.travelId != null) {
          return false;
        }
      } else if (item.travelId !== match.travelId) {
        return false;
      }
    }
    return true;
  });
  const serverIds = new Set(serverItems.map((item) => item.id));
  const extras = pending.filter((item) => !serverIds.has(item.id));
  if (extras.length === 0) {
    return [...serverItems];
  }
  return [...extras, ...serverItems].sort((left, right) =>
    right.occurredAt.localeCompare(left.occurredAt),
  );
}
