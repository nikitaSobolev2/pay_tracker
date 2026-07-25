import type { AppLocale, AppTheme } from "@/types/enums";
import type { AppUser } from "@/types/auth";

export type UpdatePreferencesInput = {
  userId: string;
  locale?: AppLocale;
  timezone?: string;
  theme?: AppTheme;
  defaultCurrency?: string;
};

export type UpdatePreferencesResult = AppUser;
