import { getDefaultCurrencies } from "@/lib/env";
import { AppServiceError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { isValidTimezone } from "@/lib/timezones";
import { ApiErrorCode } from "@/types/api";
import type { AppUser } from "@/types/auth";
import { AppLocale, AppTheme } from "@/types/enums";

import type {
  UpdatePreferencesInput,
  UpdatePreferencesResult,
} from "./user-settings-service.types";

export async function updatePreferences(
  input: UpdatePreferencesInput,
): Promise<UpdatePreferencesResult> {
  if (input.defaultCurrency) {
    const allowlist = getDefaultCurrencies();
    const currency = input.defaultCurrency.toUpperCase();
    if (!allowlist.includes(currency)) {
      throw new AppServiceError(
        ApiErrorCode.Validation,
        `Currency must be one of: ${allowlist.join(", ")}`,
      );
    }
  }

  if (input.timezone !== undefined) {
    const timezone = input.timezone.trim();
    if (!timezone || !isValidTimezone(timezone)) {
      throw new AppServiceError(ApiErrorCode.Validation, "Invalid timezone");
    }
  }

  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: {
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.timezone !== undefined
        ? { timezone: input.timezone.trim() }
        : {}),
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.defaultCurrency !== undefined
        ? { defaultCurrency: input.defaultCurrency.toUpperCase() }
        : {}),
    },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      locale: true,
      timezone: true,
      theme: true,
      defaultCurrency: true,
    },
  });

  return toAppUser(updated);
}

export async function deleteAccount(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}

function toAppUser(user: {
  id: string;
  username: string | null;
  name: string;
  email: string;
  locale: string;
  timezone: string;
  theme: string;
  defaultCurrency: string;
}): AppUser {
  if (!user.username) {
    throw new AppServiceError(ApiErrorCode.Internal, "User is missing username");
  }
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    locale: Object.values(AppLocale).includes(user.locale as AppLocale)
      ? (user.locale as AppLocale)
      : AppLocale.En,
    timezone: user.timezone,
    theme: Object.values(AppTheme).includes(user.theme as AppTheme)
      ? (user.theme as AppTheme)
      : AppTheme.System,
    defaultCurrency: user.defaultCurrency.toUpperCase(),
  };
}
