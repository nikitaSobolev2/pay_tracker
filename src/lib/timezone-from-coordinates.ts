import tzLookup from "tz-lookup";

/** Map WGS84 coordinates to an IANA timezone, or null if unknown. */
export function timezoneFromCoordinates(
  latitude: number,
  longitude: number,
): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  try {
    const zone = tzLookup(latitude, longitude);
    return typeof zone === "string" && zone.trim() ? zone : null;
  } catch {
    return null;
  }
}
