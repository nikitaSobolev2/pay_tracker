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
  TransactionKind,
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
  kinds?: TransactionKind[];
  categoryIds?: string[];
  counterpartyIds?: string[];
  hideUncategorized?: boolean;
  travelId?: string;
};

export function fetchOverviewStats(
  dateRangeType: DateRangeType,
  range?: { readonly startDate: string; readonly endDate: string },
) {
  return apiFetch<OverviewStats>(
    `/api/stats/overview${buildQuery({
      dateRangeType,
      startDate: range?.startDate,
      endDate: range?.endDate,
    })}`,
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
      kinds: params.kinds?.join(","),
      categoryIds: params.categoryIds?.join(","),
      counterpartyIds: params.counterpartyIds?.join(","),
      hideUncategorized: params.hideUncategorized ? "true" : undefined,
      travelId: params.travelId,
    })}`,
  );
}

export type ActivityHeatmapParams = {
  type?: TransactionType;
  kinds?: TransactionKind[];
  categoryIds?: string[];
  counterpartyIds?: string[];
  hideUncategorized?: boolean;
  travelId?: string;
  startDate?: string;
  endDate?: string;
};

export function fetchActivityHeatmap(params: ActivityHeatmapParams = {}) {
  return apiFetch<ActivityHeatmap>(
    `/api/stats/activity${buildQuery({
      type: params.type,
      kinds: params.kinds?.join(","),
      categoryIds: params.categoryIds?.join(","),
      counterpartyIds: params.counterpartyIds?.join(","),
      hideUncategorized: params.hideUncategorized ? "true" : undefined,
      travelId: params.travelId,
      startDate: params.startDate,
      endDate: params.endDate,
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
