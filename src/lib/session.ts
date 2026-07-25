import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AppUser } from "@/types/auth";
import { AppLocale, AppTheme } from "@/types/enums";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

function isAppLocale(value: string): value is AppLocale {
  return Object.values(AppLocale).includes(value as AppLocale);
}

function isAppTheme(value: string): value is AppTheme {
  return Object.values(AppTheme).includes(value as AppTheme);
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
    throw new Error("User is missing username");
  }
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    locale: isAppLocale(user.locale) ? user.locale : AppLocale.En,
    timezone: user.timezone || "UTC",
    theme: isAppTheme(user.theme) ? user.theme : AppTheme.System,
    defaultCurrency: user.defaultCurrency.toUpperCase(),
  };
}

export async function getSessionUser(): Promise<AppUser | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
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
  if (!user) {
    return null;
  }
  return toAppUser(user);
}

export async function requireUser(): Promise<AppUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}
