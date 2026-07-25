import { apiFetch, buildQuery } from "@/lib/api/client";
import type { SearchResponse } from "@/server/services/search-service.types";

export type { SearchResponse } from "@/server/services/search-service.types";
export type {
  SearchHit,
  SearchCategoryHit,
  SearchCounterpartyHit,
  SearchDebtHit,
  SearchDateRangeHit,
  SearchTransactionHit,
} from "@/server/services/search-service.types";

export function searchAll(query: string) {
  return apiFetch<SearchResponse>(
    `/api/search${buildQuery({ q: query })}`,
  );
}
