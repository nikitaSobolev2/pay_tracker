import { AppLocale } from "@/types/enums";

import { isAppLocale } from "@/lib/locales";

/** Matches next-intl's default cookie name. */
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

/** Persist locale across PWA / browser restarts (session cookies do not). */
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function readPreferredLocaleFromDocument(): AppLocale | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${LOCALE_COOKIE_NAME}=`));
  if (!match) {
    return null;
  }
  const value = decodeURIComponent(match.split("=").slice(1).join("="));
  return isAppLocale(value) ? value : null;
}

/** Writes a durable locale cookie for next-intl middleware + cold PWA starts. */
export function persistPreferredLocale(locale: AppLocale): void {
  if (typeof document === "undefined") {
    return;
  }
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}
