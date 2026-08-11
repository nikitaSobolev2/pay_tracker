import type { CreateTransactionInput } from "@/lib/api/transactions";
import type { FastQueueStatus } from "@/types/enums";

export type TransactionOfflineQueueItem = {
  localId: string;
  body: CreateTransactionInput;
  createdAtLocal: string;
  status: FastQueueStatus;
  transactionId?: string;
  errorMessage?: string;
};
