import { defineRouting } from "next-intl/routing";

import { AppLocale } from "@/types/enums";

export const routing = defineRouting({
  locales: [AppLocale.En, AppLocale.Ru],
  defaultLocale: AppLocale.En,
});
