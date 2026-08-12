import { AppServiceError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api";
import { AppLocale } from "@/types/enums";

export type GeocodeResultDto = {
  readonly displayName: string;
  readonly latitude: number;
  readonly longitude: number;
};

const GEOCODER_BASE_URL = "https://geocode-maps.yandex.ru/1.x/";
const SUGGEST_BASE_URL = "https://suggest-maps.yandex.ru/v1/suggest";
const CACHE_LIMIT = 200;
const SEARCH_LIMIT = 5;
const MIN_QUERY_LENGTH = 3;

const cache = new Map<string, GeocodeResultDto[]>();

function readGeocoderApiKey(): string {
  const key = process.env.YANDEX_GEOCODER_API_KEY?.trim();
  if (!key) {
    throw new AppServiceError(
      ApiErrorCode.Internal,
      "Address lookup is not configured (missing YANDEX_GEOCODER_API_KEY)",
    );
  }
  return key;
}

export function toYandexLanguage(locale: string): string {
  return locale.startsWith(AppLocale.En) ? "en_US" : "ru_RU";
}

export async function searchPlaces(
  query: string,
  locale: string,
): Promise<GeocodeResultDto[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return [];
  }
  const apiKey = readGeocoderApiKey();
  const lang = toYandexLanguage(locale);
  const suggestUrl = new URL(SUGGEST_BASE_URL);
  suggestUrl.searchParams.set("apikey", apiKey);
  suggestUrl.searchParams.set("text", trimmed);
  suggestUrl.searchParams.set("lang", lang);
  suggestUrl.searchParams.set("results", String(SEARCH_LIMIT));
  suggestUrl.searchParams.set("print_address", "1");
  suggestUrl.searchParams.set("attrs", "uri");
  suggestUrl.searchParams.set("types", "geo,street,house,locality,district");

  const cacheKey = suggestUrl.toString();
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(cacheKey, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throwUnavailableLookup(response.status);
  }

  const suggestions = parseSuggestResponse(await response.json());
  const places: GeocodeResultDto[] = [];
  for (const suggestion of suggestions) {
    const resolved = await resolveSuggestion(suggestion, lang, apiKey);
    if (resolved) {
      places.push(resolved);
    }
    if (places.length >= SEARCH_LIMIT) {
      break;
    }
  }

  rememberInCache(cacheKey, places);
  return places;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  locale: string,
): Promise<GeocodeResultDto | null> {
  const apiKey = readGeocoderApiKey();
  const places = await geocodeQuery(
    `${longitude},${latitude}`,
    toYandexLanguage(locale),
    apiKey,
    1,
  );
  return places[0] ?? null;
}

type SuggestItem = {
  readonly displayName: string;
  readonly uri: string | null;
};

/** Exported for unit tests — maps Geosuggest JSON into display names + uris. */
export function parseSuggestResponse(payload: unknown): SuggestItem[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) {
    return [];
  }
  return results
    .map((item) => toSuggestItem(item))
    .filter((item): item is SuggestItem => item !== null);
}

/** Exported for unit tests — maps Geocoder JSON into places. */
export function parseGeocoderResponse(payload: unknown): GeocodeResultDto[] {
  const members = readFeatureMembers(payload);
  return members
    .map((member) => toGeocodeResult(member))
    .filter((place): place is GeocodeResultDto => place !== null);
}

function toSuggestItem(item: unknown): SuggestItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const row = item as {
    title?: { text?: unknown };
    address?: { formatted_address?: unknown };
    uri?: unknown;
  };
  const fromAddress = readText(row.address?.formatted_address);
  const fromTitle = readText(row.title?.text);
  const displayName = fromAddress ?? fromTitle;
  if (!displayName) {
    return null;
  }
  return {
    displayName,
    uri: readText(row.uri),
  };
}

async function resolveSuggestion(
  suggestion: SuggestItem,
  lang: string,
  apiKey: string,
): Promise<GeocodeResultDto | null> {
  const geocodeInput = suggestion.uri ?? suggestion.displayName;
  const places = await geocodeQuery(geocodeInput, lang, apiKey, 1);
  const place = places[0];
  if (!place) {
    return null;
  }
  return {
    displayName: suggestion.displayName || place.displayName,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

async function geocodeQuery(
  geocode: string,
  lang: string,
  apiKey: string,
  results: number,
): Promise<GeocodeResultDto[]> {
  const url = new URL(GEOCODER_BASE_URL);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("geocode", geocode);
  url.searchParams.set("lang", lang);
  url.searchParams.set("results", String(results));

  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(cacheKey, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throwUnavailableLookup(response.status);
  }

  const places = parseGeocoderResponse(await response.json());
  rememberInCache(cacheKey, places);
  return places;
}

function throwUnavailableLookup(status: number): never {
  if (status === 401 || status === 403) {
    throw new AppServiceError(
      ApiErrorCode.Internal,
      "Address lookup rejected the API key (check YANDEX_GEOCODER_API_KEY)",
    );
  }
  throw new AppServiceError(
    ApiErrorCode.Internal,
    "Address lookup is unavailable",
  );
}

function readFeatureMembers(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const collection = (payload as {
    response?: { GeoObjectCollection?: { featureMember?: unknown } };
  }).response?.GeoObjectCollection?.featureMember;
  return Array.isArray(collection) ? collection : [];
}

function toGeocodeResult(member: unknown): GeocodeResultDto | null {
  if (!member || typeof member !== "object") {
    return null;
  }
  const geoObject = (member as { GeoObject?: unknown }).GeoObject;
  if (!geoObject || typeof geoObject !== "object") {
    return null;
  }
  const object = geoObject as {
    name?: unknown;
    description?: unknown;
    Point?: { pos?: unknown };
    metaDataProperty?: {
      GeocoderMetaData?: {
        text?: unknown;
        Address?: { formatted?: unknown };
      };
    };
  };
  const pos = readText(object.Point?.pos);
  if (!pos) {
    return null;
  }
  const [lonText, latText] = pos.split(/\s+/);
  const longitude = Number(lonText);
  const latitude = Number(latText);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  const displayName =
    readText(object.metaDataProperty?.GeocoderMetaData?.Address?.formatted) ??
    readText(object.metaDataProperty?.GeocoderMetaData?.text) ??
    joinParts([readText(object.name), readText(object.description)]);
  if (!displayName) {
    return null;
  }
  return { displayName, latitude, longitude };
}

function joinParts(parts: readonly (string | null)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(", ");
}

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rememberInCache(key: string, places: GeocodeResultDto[]): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, places);
}
