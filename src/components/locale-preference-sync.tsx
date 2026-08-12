"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef } from "react";

import { useAppUser } from "@/hooks/use-app-user";
import { usePathname, useRouter } from "@/i18n/navigation";
import { isAppLocale } from "@/lib/locales";
import { persistPreferredLocale } from "@/lib/locale-preference";

/**
 * Keeps the URL locale aligned with the account preference after PWA/browser
 * restarts (next-intl's default locale cookie is session-only).
 */
export function LocalePreferenceSync() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAppUser();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (loading || !user) {
      return;
    }
    if (!isAppLocale(user.locale)) {
      return;
    }

    persistPreferredLocale(user.locale);

    if (user.locale === locale || redirectedRef.current) {
      return;
    }
    redirectedRef.current = true;
    router.replace(pathname, { locale: user.locale });
  }, [loading, locale, pathname, router, user]);

  return null;
}
