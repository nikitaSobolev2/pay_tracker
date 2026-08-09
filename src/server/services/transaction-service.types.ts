import type {
  DateRangeType,
  SortDirection,
  TransactionKind,
  TransactionSortBy,
  TransactionType,
} from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

export type CreateTransactionInput = {
  userId: string;
  displayCurrency: string;
  type: TransactionType;
  originalAmount: string;
  inputCurrency: string;
  title?: string | null;
  occurredAt: Date;
  kind?: TransactionKind;
  counterpartyName?: string | null;
  categoryIds?: string[];
  travelId?: string | null;
  idempotencyKey: string;
};

export type UpdateTransactionInput = {
  userId: string;
  displayCurrency: string;
  transactionId: string;
  type?: TransactionType;
  originalAmount?: string;
  inputCurrency?: string;
  title?: string | null;
  occurredAt?: Date;
  kind?: TransactionKind;
  counterpartyName?: string | null;
  categoryIds?: string[];
  travelId?: string | null;
};

export type ListTransactionsInput = {
  userId: string;
  displayCurrency: string;
  timezone: string;
  dateRangeType?: DateRangeType;
  rollingUnit?: "days" | "months" | "years";
  rollingN?: number;
  startDate?: string;
  endDate?: string;
  type?: TransactionType;
  kinds?: TransactionKind[];
  categoryIds?: string[];
  counterpartyIds?: string[];
  travelId?: string;
  hideUncategorized?: boolean;
  sortBy?: TransactionSortBy;
  sortDir?: SortDirection;
  page?: number;
  pageSize?: number;
};

export type ListTransactionsResult = {
  items: TransactionDto[];
  page: number;
  pageSize: number;
  total: number;
};

export type BulkDeleteTransactionsInput = {
  userId: string;
  ids: string[];
};

export type ClearTransactionsInput = {
  userId: string;
  timezone: string;
  startDate?: string;
  endDate?: string;
};

export type TitleSuggestionsInput = {
  userId: string;
  displayCurrency: string;
  query: string;
  type?: TransactionType;
  limit?: number;
};
