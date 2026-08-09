import type { FastQueueStatus, TransactionType } from "@/types/enums";

export type FastQueueItem = {
  localId: string;
  type: TransactionType;
  amount: string;
  currency: string;
  occurredAt: string;
  idempotencyKey: string;
  travelId?: string | null;
  createdAtLocal: string;
  status: FastQueueStatus;
  transactionId?: string;
  errorMessage?: string;
};
