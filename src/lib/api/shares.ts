import { apiFetch } from "@/lib/api/client";
import type { SharedChartPayload } from "@/features/share/shared-chart-payload";
import type {
  PublicSharedChartDto,
  SharedChartDto,
} from "@/server/services/shared-chart-service";
import type { ListPageStats } from "@/server/services/stats-service.types";

export function createShare(input: {
  title?: string | null;
  payload: SharedChartPayload;
}) {
  return apiFetch<SharedChartDto>("/api/shares", {
    method: "POST",
    body: input,
  });
}

export function listShares() {
  return apiFetch<SharedChartDto[]>("/api/shares");
}

export function updateShare(
  id: string,
  input: { title?: string | null; isPublic?: boolean },
) {
  return apiFetch<SharedChartDto>(`/api/shares/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteShare(id: string) {
  return apiFetch<void>(`/api/shares/${id}`, {
    method: "DELETE",
  });
}

export function fetchPublicShare(id: string) {
  return apiFetch<PublicSharedChartDto>(`/api/shares/${id}`);
}

export function fetchPublicShareDay(id: string, date: string) {
  return apiFetch<ListPageStats>(
    `/api/shares/${id}/day?date=${encodeURIComponent(date)}`,
  );
}

export function fetchPublicSharePeriod(
  id: string,
  range: { readonly startDate: string; readonly endDate: string },
) {
  const params = new URLSearchParams({
    startDate: range.startDate,
    endDate: range.endDate,
  });
  return apiFetch<ListPageStats>(`/api/shares/${id}/day?${params.toString()}`);
}
