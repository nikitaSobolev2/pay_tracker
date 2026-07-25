const FALLBACK_TIMEZONES = [
  "UTC",
  "Europe/Moscow",
  "Europe/London",
  "America/New_York",
  "Asia/Dubai",
  "Asia/Tokyo",
] as const;

export function listTimezones(): string[] {
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      return [...Intl.supportedValuesOf("timeZone")].sort((left, right) =>
        left.localeCompare(right),
      );
    }
  } catch {
    // Fall through to the curated list when the runtime lacks IANA support.
  }
  return [...FALLBACK_TIMEZONES];
}

export function isValidTimezone(timezone: string): boolean {
  const trimmed = timezone.trim();
  if (!trimmed) {
    return false;
  }
  try {
    Intl.DateTimeFormat("en-US", { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}
