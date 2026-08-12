import { defineRouting } from "next-intl/routing";

import { LOCALE_COOKIE_MAX_AGE_SECONDS } from "@/lib/locale-preference";
import { AppLocale } from "@/types/enums";

export const routing = defineRouting({
  locales: [AppLocale.En, AppLocale.Ru],
  defaultLocale: AppLocale.En,
  // Durable cookie so PWA / mobile restarts keep the chosen locale.
  localeCookie: {
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
  },
});
