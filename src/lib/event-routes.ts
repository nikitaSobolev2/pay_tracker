/** In-app event detail (AppShell). Logged-in visitors use this path. */
export function eventAppPath(eventId: string): string {
  return `/events/${eventId}`;
}

/** Public guest event page. Share links and unauthenticated visitors stay here. */
export function eventPublicPath(eventId: string): string {
  return `/event/${eventId}`;
}

/**
 * Map a locale-prefixed public event URL onto the in-app events URL.
 * `/en/event/abc` → `/en/events/abc`. Query string is not part of `pathname`.
 */
export function rewritePublicEventPathToApp(
  pathname: string,
  pathWithoutLocale: string,
): string | null {
  if (!pathWithoutLocale.startsWith("/event/")) {
    return null;
  }
  const localePrefix =
    pathname.length > pathWithoutLocale.length
      ? pathname.slice(0, pathname.length - pathWithoutLocale.length)
      : "";
  return `${localePrefix}/events${pathWithoutLocale.slice("/event".length)}`;
}
