import { apiFetch, buildQuery } from "@/lib/api/client";
import type {
  TravelAiReportDto,
  TravelCategoryBudgetDto,
  TravelDetailDto,
  TravelListItemDto,
  TravelPlaceToVisitDto,
  TravelPlannedSpendingDto,
  TravelSuggestItemDto,
} from "@/server/services/travel-service.types";
import type { TravelPhase, TravelPlannedCategory } from "@/types/enums";

export type CreateTravelBody = {
  title: string;
  startsAt: string;
  endsAt: string;
  imageUrl?: string | null;
  placeCountry?: string | null;
  placeCity?: string | null;
  placeLabel?: string | null;
  maxSpendingGoal?: string | null;
};

export type UpdateTravelBody = Partial<CreateTravelBody> & {
  phaseOverride?: TravelPhase | null;
  clearPhaseOverride?: boolean;
};

export type PlannedSpendingBody = {
  title: string;
  category: TravelPlannedCategory;
  amount: string;
  note?: string | null;
};

export type PlaceToVisitBody = {
  title: string;
  link?: string | null;
  address?: string | null;
};

export function listTravels() {
  return apiFetch<{ travels: TravelListItemDto[] }>("/api/travels");
}

export function createTravel(body: CreateTravelBody) {
  return apiFetch<{ travelId: string }>("/api/travels", {
    method: "POST",
    body,
  });
}

export function fetchTravel(travelId: string) {
  return apiFetch<{ travel: TravelDetailDto }>(`/api/travels/${travelId}`);
}

export function updateTravel(travelId: string, body: UpdateTravelBody) {
  return apiFetch<{ travel: TravelDetailDto }>(`/api/travels/${travelId}`, {
    method: "PATCH",
    body,
  });
}

export function deleteTravel(travelId: string) {
  return apiFetch<{ ok: true }>(`/api/travels/${travelId}`, {
    method: "DELETE",
  });
}

export function fetchActiveTravel() {
  return apiFetch<{ travel: TravelListItemDto | null }>("/api/travels/active");
}

export function suggestTravels(query: string) {
  return apiFetch<{ travels: TravelSuggestItemDto[] }>(
    `/api/travels/suggest${buildQuery({ q: query })}`,
  );
}

export function createPlannedSpending(
  travelId: string,
  body: PlannedSpendingBody,
) {
  return apiFetch<{ spending: TravelPlannedSpendingDto }>(
    `/api/travels/${travelId}/planned-spendings`,
    { method: "POST", body },
  );
}

export function updatePlannedSpending(
  travelId: string,
  spendingId: string,
  body: Partial<PlannedSpendingBody>,
) {
  return apiFetch<{ spending: TravelPlannedSpendingDto }>(
    `/api/travels/${travelId}/planned-spendings/${spendingId}`,
    { method: "PATCH", body },
  );
}

export function deletePlannedSpending(travelId: string, spendingId: string) {
  return apiFetch<{ ok: true }>(
    `/api/travels/${travelId}/planned-spendings/${spendingId}`,
    { method: "DELETE" },
  );
}

export function upsertCategoryBudget(
  travelId: string,
  body: { category: TravelPlannedCategory; amount: string | null },
) {
  return apiFetch<{ budget: TravelCategoryBudgetDto | null }>(
    `/api/travels/${travelId}/category-budgets`,
    { method: "PUT", body },
  );
}

export function createPlaceToVisit(travelId: string, body: PlaceToVisitBody) {
  return apiFetch<{ place: TravelPlaceToVisitDto }>(
    `/api/travels/${travelId}/places-to-visit`,
    { method: "POST", body },
  );
}

export function updatePlaceToVisit(
  travelId: string,
  placeId: string,
  body: Partial<PlaceToVisitBody>,
) {
  return apiFetch<{ place: TravelPlaceToVisitDto }>(
    `/api/travels/${travelId}/places-to-visit/${placeId}`,
    { method: "PATCH", body },
  );
}

export function deletePlaceToVisit(travelId: string, placeId: string) {
  return apiFetch<{ ok: true }>(
    `/api/travels/${travelId}/places-to-visit/${placeId}`,
    { method: "DELETE" },
  );
}

export function analyzeTravel(
  travelId: string,
  body: { responseLocale: string; contextMessage?: string | null },
) {
  return apiFetch<{ report: TravelAiReportDto }>(
    `/api/travels/${travelId}/analyze`,
    { method: "POST", body },
  );
}

export function uploadTravelCover(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<{ url: string }>("/api/uploads/travel-cover", {
    method: "POST",
    formData,
  });
}
