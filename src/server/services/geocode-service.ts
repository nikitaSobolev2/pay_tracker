import { AppServiceError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api";
import { AppLocale } from "@/types/enums";

export type GeocodeResultDto = {
  readonly displayName: string;
  readonly latitude: number;
  readonly longitude: number;
};

type PhotonProperties = {
  readonly name?: unknown;
  readonly housenumber?: unknown;
  readonly street?: unknown;
  readonly locality?: unknown;
  readonly district?: unknown;
  readonly city?: unknown;
  readonly state?: unknown;
  readonly country?: unknown;
  readonly postcode?: unknown;
};

type PhotonFeature = {
  readonly properties?: PhotonProperties;
  readonly geometry?: { readonly coordinates?: unknown };
};

/** Photon is typo tolerant and matches free-form Russian queries Nominatim misses. */
const PHOTON_BASE_URL =
  process.env.GEOCODE_BASE_URL ?? "https://photon.komoot.io";
const USER_AGENT = "PayTracker/1.0 (self-hosted expense tracker)";
const CACHE_LIMIT = 200;
const SEARCH_LIMIT = 5;
const MIN_QUERY_LENGTH = 3;

const cache = new Map<string, GeocodeResultDto[]>();

export async function searchPlaces(
  query: string,
  locale: string,
): Promise<GeocodeResultDto[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return [];
  }
  const url = new URL(`${PHOTON_BASE_URL}/api/`);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", String(SEARCH_LIMIT));
  // Cyrillic queries must use local spelling — Photon's lang=en anglicizes
  // names, and lang=ru returns empty for many Russian streets.
  url.searchParams.set("lang", toPhotonSearchLanguage(trimmed, locale));
  return fetchPlaces(url);
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  locale: string,
): Promise<GeocodeResultDto | null> {
  const url = new URL(`${PHOTON_BASE_URL}/reverse`);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("lang", toPhotonLanguage(locale));
  const places = await fetchPlaces(url);
  return places[0] ?? null;
}

/**
 * Photon only speaks a few interface languages; "default" keeps the local
 * spelling, which is what a Russian address should read like.
 */
export function toPhotonLanguage(locale: string): string {
  return locale.startsWith(AppLocale.En) ? "en" : "default";
}

/** Prefer the query's script so Russian text still works in the English UI. */
export function toPhotonSearchLanguage(query: string, locale: string): string {
  return containsCyrillic(query) ? "default" : toPhotonLanguage(locale);
}

function containsCyrillic(value: string): boolean {
  return /[\u0400-\u04FF]/.test(value);
}

/** Photon answers with a GeoJSON FeatureCollection for both search and reverse. */
export function parsePhotonResponse(payload: unknown): GeocodeResultDto[] {
  const features = readFeatures(payload);
  return features
    .map((feature) => toGeocodeResult(feature))
    .filter((place): place is GeocodeResultDto => place !== null);
}

function readFeatures(payload: unknown): PhotonFeature[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const features = (payload as { features?: unknown }).features;
  return Array.isArray(features) ? (features as PhotonFeature[]) : [];
}

function toGeocodeResult(feature: PhotonFeature): GeocodeResultDto | null {
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }
  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  const displayName = buildDisplayName(feature.properties ?? {});
  if (!displayName) {
    return null;
  }
  return { displayName, latitude, longitude };
}

function buildDisplayName(properties: PhotonProperties): string {
  const street = joinParts([
    readText(properties.street) ?? readText(properties.name),
    readText(properties.housenumber),
  ]);
  const headline = street || readText(properties.name);
  return joinParts([
    headline,
    readText(properties.district) ?? readText(properties.locality),
    readText(properties.city),
    readText(properties.state),
    readText(properties.country),
  ]);
}

function joinParts(parts: readonly (string | null)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(", ");
}

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function fetchPlaces(url: URL): Promise<GeocodeResultDto[]> {
  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(cacheKey, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new AppServiceError(
      ApiErrorCode.Internal,
      "Address lookup is unavailable",
    );
  }

  const places = parsePhotonResponse(await response.json());
  rememberInCache(cacheKey, places);
  return places;
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
