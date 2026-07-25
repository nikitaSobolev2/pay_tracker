import { apiFetch, buildQuery } from "@/lib/api/client";
import type {
  CategoryDetailStats,
  DebtDetailStats,
} from "@/server/services/detail-stats-service.types";
import type {
  ActivityHeatmap,
  DebtsStats,
  ListPageStats,
  OverviewStats,
} from "@/server/services/stats-service.types";
import type {
  DateRangeType,
  TransactionDebtRole,
  TransactionType,
} from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

export type ListStatsParams = {
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
};

export function fetchOverviewStats(dateRangeType: DateRangeType) {
  return apiFetch<OverviewStats>(
    `/api/stats/overview${buildQuery({ dateRangeType })}`,
  );
}

export function fetchTransactionStats(params: ListStatsParams = {}) {
  return apiFetch<ListPageStats>(
    `/api/stats/transactions${buildQuery({
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
    })}`,
  );
}

export type ActivityHeatmapParams = {
  type?: TransactionType;
  debtRoles?: TransactionDebtRole[];
  categoryIds?: string[];
  counterpartyIds?: string[];
  hideUncategorized?: boolean;
};

export function fetchActivityHeatmap(params: ActivityHeatmapParams = {}) {
  return apiFetch<ActivityHeatmap>(
    `/api/stats/activity${buildQuery({
      type: params.type,
      debtRoles: params.debtRoles?.join(","),
      categoryIds: params.categoryIds?.join(","),
      counterpartyIds: params.counterpartyIds?.join(","),
      hideUncategorized: params.hideUncategorized ? "true" : undefined,
    })}`,
  );
}

export function fetchDebtsStats() {
  return apiFetch<DebtsStats>("/api/stats/debts");
}

export function fetchCategoryDetailStats(categoryId: string) {
  return apiFetch<{ stats: CategoryDetailStats }>(
    `/api/stats/category/${categoryId}`,
  );
}

export function fetchDebtDetailStats(counterpartyId: string) {
  return apiFetch<{ stats: DebtDetailStats }>(
    `/api/stats/debts/${counterpartyId}`,
  );
}

export function fetchTransactionContext(transactionId: string) {
  return apiFetch<{
    transaction: TransactionDto;
    categoryStats: CategoryDetailStats | null;
    relatedTransactions: TransactionDto[];
  }>(`/api/transactions/${transactionId}/context`);
}
