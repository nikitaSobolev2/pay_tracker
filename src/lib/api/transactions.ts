import { apiFetch, buildQuery } from "@/lib/api/client";
import type {
  DateRangeType,
  TransactionDebtRole,
  TransactionType,
} from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

export type TransactionListParams = {
  dateRangeType?: DateRangeType;
  rollingUnit?: "days" | "months" | "years";
  rollingN?: number;
  startDate?: string;
  endDate?: string;
  type?: TransactionType;
  debtRoles?: TransactionDebtRole[];
  categoryIds?: string[];
  counterpartyIds?: string[];
  hideUncategorized?: boolean;
  page?: number;
  pageSize?: number;
};

export type TransactionListResponse = {
  items: TransactionDto[];
  page: number;
  pageSize: number;
  total: number;
};

export type CreateTransactionInput = {
  type: TransactionType;
  originalAmount: string;
  inputCurrency: string;
  title?: string | null;
  occurredAt: string;
  debtRole?: TransactionDebtRole | null;
  counterpartyName?: string | null;
  categoryIds?: string[];
  idempotencyKey: string;
};

export type UpdateTransactionInput = Partial<{
  type: TransactionType;
  originalAmount: string;
  inputCurrency: string;
  title: string | null;
  occurredAt: string;
  debtRole: TransactionDebtRole | null;
  counterpartyName: string | null;
  categoryIds: string[];
}>;

function toListQuery(params: TransactionListParams): string {
  return buildQuery({
    dateRangeType: params.dateRangeType,
    rollingUnit: params.rollingUnit,
    rollingN: params.rollingN,
    startDate: params.startDate,
    endDate: params.endDate,
    type: params.type,
    debtRoles: params.debtRoles?.join(","),
    categoryIds: params.categoryIds?.join(","),
    counterpartyIds: params.counterpartyIds?.join(","),
    hideUncategorized: params.hideUncategorized ? "true" : undefined,
    page: params.page,
    pageSize: params.pageSize,
  });
}

export function listTransactions(params: TransactionListParams = {}) {
  return apiFetch<TransactionListResponse>(
    `/api/transactions${toListQuery(params)}`,
  );
}

export function createTransaction(input: CreateTransactionInput) {
  return apiFetch<{ transaction: TransactionDto }>("/api/transactions", {
    method: "POST",
    body: input,
    headers: { "Idempotency-Key": input.idempotencyKey },
  });
}

export function getTransaction(id: string) {
  return apiFetch<{ transaction: TransactionDto }>(`/api/transactions/${id}`);
}

export function updateTransaction(id: string, input: UpdateTransactionInput) {
  return apiFetch<{ transaction: TransactionDto }>(`/api/transactions/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteTransaction(id: string) {
  return apiFetch<{ ok: true }>(`/api/transactions/${id}`, {
    method: "DELETE",
  });
}

export function restoreTransaction(id: string) {
  return apiFetch<{ ok: true }>(`/api/transactions/${id}/restore`, {
    method: "POST",
  });
}

export function bulkDeleteTransactions(ids: string[]) {
  return apiFetch<{ deletedCount: number }>("/api/transactions/bulk-delete", {
    method: "POST",
    body: { ids },
  });
}
