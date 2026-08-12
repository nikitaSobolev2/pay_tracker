import type { GeocodeResultDto } from "@/server/services/geocode-service";

import {
  reversePlaceWithYmaps,
  searchPlacesWithYmaps,
} from "@/lib/yandex-geocode-client";

/** Address search via Yandex Maps JS API (uses NEXT_PUBLIC_YANDEX_MAPS_API_KEY). */
export async function searchAddress(query: string, locale: string) {
  const places = await searchPlacesWithYmaps(query, locale);
  return { places } satisfies { places: GeocodeResultDto[] };
}

/** Reverse geocode via Yandex Maps JS API (uses NEXT_PUBLIC_YANDEX_MAPS_API_KEY). */
export async function reverseAddress(
  latitude: number,
  longitude: number,
  locale: string,
) {
  const place = await reversePlaceWithYmaps(latitude, longitude, locale);
  return { place } satisfies { place: GeocodeResultDto | null };
}
