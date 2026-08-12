import type { GeocodeResultDto } from "@/server/services/geocode-service";

import {
  loadYmaps,
  readYandexMapsApiKey,
  toYmapsLang,
  type YMapsApi,
  type YMapsGeoObject,
} from "@/lib/yandex-maps";

const SEARCH_LIMIT = 5;

export async function searchPlacesWithYmaps(
  query: string,
  locale: string,
): Promise<GeocodeResultDto[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const ymaps = await requireYmaps(locale);
  const result = await ymaps.geocode(trimmed, {
    results: SEARCH_LIMIT,
    lang: toYmapsLang(locale),
  });
  return collectPlaces(result.geoObjects.getLength(), (index) =>
    result.geoObjects.get(index),
  );
}

export async function reversePlaceWithYmaps(
  latitude: number,
  longitude: number,
  locale: string,
): Promise<GeocodeResultDto | null> {
  const ymaps = await requireYmaps(locale);
  const result = await ymaps.geocode([latitude, longitude], {
    results: 1,
    lang: toYmapsLang(locale),
  });
  const places = collectPlaces(result.geoObjects.getLength(), (index) =>
    result.geoObjects.get(index),
  );
  return places[0] ?? null;
}

/** Resolve a place center (country/city/address) in the UI language. */
export async function geocodeCenterWithYmaps(
  query: string,
  locale: string,
  kind?: "country" | "locality" | "house",
): Promise<GeocodeResultDto | null> {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }
  const ymaps = await requireYmaps(locale);
  const result = await ymaps.geocode(trimmed, {
    results: 1,
    lang: toYmapsLang(locale),
    kind,
  });
  const places = collectPlaces(result.geoObjects.getLength(), (index) =>
    result.geoObjects.get(index),
  );
  return places[0] ?? null;
}

/** Locality (city) search in the UI language, biased to a country display name. */
export async function searchLocalitiesWithYmaps(
  query: string,
  countryDisplayName: string,
  locale: string,
): Promise<GeocodeResultDto[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }
  const ymaps = await requireYmaps(locale);
  const geocodeQuery = countryDisplayName
    ? `${trimmed}, ${countryDisplayName}`
    : trimmed;
  const result = await ymaps.geocode(geocodeQuery, {
    results: SEARCH_LIMIT,
    lang: toYmapsLang(locale),
    kind: "locality",
  });
  return collectPlaces(result.geoObjects.getLength(), (index) =>
    result.geoObjects.get(index),
    {
      preferLocalityName: true,
    },
  );
}

async function requireYmaps(locale: string): Promise<YMapsApi> {
  const apiKey = readYandexMapsApiKey();
  if (!apiKey) {
    throw new Error("Map is not configured");
  }
  return loadYmaps(apiKey, toYmapsLang(locale));
}

function collectPlaces(
  length: number,
  readObject: (index: number) => YMapsGeoObject | undefined,
  options?: { preferLocalityName?: boolean },
): GeocodeResultDto[] {
  const places: GeocodeResultDto[] = [];
  for (let index = 0; index < length; index += 1) {
    const place = toPlace(readObject(index), options);
    if (place) {
      places.push(place);
    }
  }
  return places;
}

function toPlace(
  object: YMapsGeoObject | undefined,
  options?: { preferLocalityName?: boolean },
): GeocodeResultDto | null {
  if (!object) {
    return null;
  }
  const coordinates = object.geometry?.getCoordinates?.() ?? null;
  if (!coordinates) {
    return null;
  }
  const [latitude, longitude] = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  const locality = object.getLocalities?.()?.[0]?.trim();
  const addressLine = object.getAddressLine()?.trim();
  const displayName = options?.preferLocalityName
    ? locality || addressLine
    : addressLine || locality;
  if (!displayName) {
    return null;
  }
  return { displayName, latitude, longitude };
}
