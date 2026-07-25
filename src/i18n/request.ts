import { getRequestConfig } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { AppLocale } from "@/types/enums";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as AppLocale)) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    timeZone: "UTC",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
