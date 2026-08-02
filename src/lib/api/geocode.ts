import { apiFetch, buildQuery } from "@/lib/api/client";
import type { GeocodeResultDto } from "@/server/services/geocode-service";

export function searchAddress(query: string, locale: string) {
  return apiFetch<{ places: GeocodeResultDto[] }>(
    `/api/geocode${buildQuery({ q: query, locale })}`,
  );
}

export function reverseAddress(
  latitude: number,
  longitude: number,
  locale: string,
) {
  return apiFetch<{ place: GeocodeResultDto | null }>(
    `/api/geocode/reverse${buildQuery({
      lat: latitude,
      lon: longitude,
      locale,
    })}`,
  );
}
