import { apiFetch, buildQuery } from "@/lib/api/client";
import type {
  TravelAiReportDto,
  TravelCategoryBudgetDto,
  TravelDetailDto,
  TravelListItemDto,
  TravelPlaceToVisitDto,
  TravelPlannedSpendingDto,
  TravelSuggestItemDto,
  TravelThingToGrabDto,
  TravelTicketDto,
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
  housingAddress?: string | null;
  housingLatitude?: number | null;
  housingLongitude?: number | null;
  housingFloor?: string | null;
  housingEntrance?: string | null;
  housingApartment?: string | null;
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
  isChecked?: boolean;
};

export type ThingToGrabBody = {
  title: string;
  amount: number;
  isChecked?: boolean;
};

export type TravelTicketSegmentBody = {
  origin?: string | null;
  destination?: string | null;
  departsAt?: string | null;
  arrivesAt?: string | null;
  ticketNumber?: string | null;
  flightNumber?: string | null;
  bookingCode?: string | null;
};

export type TravelTicketBody = TravelTicketSegmentBody & {
  title: string;
  fileUrl: string;
  fileName: string;
  contentType: string;
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

export function createThingToGrab(travelId: string, body: ThingToGrabBody) {
  return apiFetch<{ item: TravelThingToGrabDto }>(
    `/api/travels/${travelId}/things-to-grab`,
    { method: "POST", body },
  );
}

export function updateThingToGrab(
  travelId: string,
  itemId: string,
  body: Partial<ThingToGrabBody>,
) {
  return apiFetch<{ item: TravelThingToGrabDto }>(
    `/api/travels/${travelId}/things-to-grab/${itemId}`,
    { method: "PATCH", body },
  );
}

export function deleteThingToGrab(travelId: string, itemId: string) {
  return apiFetch<{ ok: true }>(
    `/api/travels/${travelId}/things-to-grab/${itemId}`,
    { method: "DELETE" },
  );
}

export function createTravelTicket(travelId: string, body: TravelTicketBody) {
  return apiFetch<{ ticket: TravelTicketDto }>(
    `/api/travels/${travelId}/tickets`,
    { method: "POST", body },
  );
}

export function updateTravelTicket(
  travelId: string,
  ticketId: string,
  body: { title: string },
) {
  return apiFetch<{ ticket: TravelTicketDto }>(
    `/api/travels/${travelId}/tickets/${ticketId}`,
    { method: "PATCH", body },
  );
}

export function deleteTravelTicket(travelId: string, ticketId: string) {
  return apiFetch<{ ok: true }>(
    `/api/travels/${travelId}/tickets/${ticketId}`,
    { method: "DELETE" },
  );
}

export function analyzeTravelTicketFile(travelId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<{ tickets: AnalyzedTicketSegment[] }>(
    `/api/travels/${travelId}/tickets/analyze`,
    { method: "POST", formData },
  );
}

export type AnalyzedTicketSegment = {
  title: string;
  origin: string | null;
  destination: string | null;
  departsAt: string | null;
  arrivesAt: string | null;
  ticketNumber: string | null;
  flightNumber: string | null;
  bookingCode: string | null;
};

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

export function uploadTravelTicketFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<{ url: string; fileName: string; contentType: string }>(
    "/api/uploads/travel-ticket",
    {
      method: "POST",
      formData,
    },
  );
}
