import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseBearerToken,
  sessionTokenCandidates,
} from "@/lib/session-token";
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

const userSelect = {
  id: true,
  username: true,
  name: true,
  email: true,
  locale: true,
  timezone: true,
  theme: true,
  defaultCurrency: true,
} as const;

async function loadAppUserById(userId: string): Promise<AppUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });
  if (!user) {
    return null;
  }
  return toAppUser(user);
}

async function getUserByBearerToken(token: string): Promise<AppUser | null> {
  const now = new Date();
  for (const candidate of sessionTokenCandidates(token)) {
    const session = await prisma.session.findUnique({
      where: { token: candidate },
      select: {
        expiresAt: true,
        userId: true,
      },
    });
    if (!session) {
      continue;
    }
    if (session.expiresAt <= now) {
      return null;
    }
    return loadAppUserById(session.userId);
  }
  return null;
}

export async function getSessionUser(): Promise<AppUser | null> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });
  if (session?.user?.id) {
    return loadAppUserById(session.user.id);
  }

  const bearerToken = parseBearerToken(requestHeaders.get("authorization"));
  if (!bearerToken) {
    return null;
  }
  return getUserByBearerToken(bearerToken);
}

export async function requireUser(): Promise<AppUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}
