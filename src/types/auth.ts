import type { AppLocale, AppTheme } from "@/types/enums";

export type AppUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  locale: AppLocale;
  timezone: string;
  theme: AppTheme;
  defaultCurrency: string;
};
