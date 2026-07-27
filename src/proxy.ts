import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";

import { routing } from "@/i18n/routing";
import { AppLocale } from "@/types/enums";

const intlMiddleware = createMiddleware(routing);

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) {
      return "/";
    }
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1);
    }
  }
  return pathname;
}

function isAuthPage(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/login/code" ||
    pathname === "/login/qr" ||
    pathname.startsWith("/login/qr/")
  );
}

/** Public pages that do not require a session (and must stay open when logged in). */
function isPublicContentPage(pathname: string): boolean {
  return pathname === "/share" || pathname.startsWith("/share/");
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  const pathWithoutLocale = stripLocale(pathname);
  const localeMatch = routing.locales.find(
    (locale) =>
      pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  const locale = localeMatch ?? AppLocale.En;

  if (
    !sessionCookie &&
    !isAuthPage(pathWithoutLocale) &&
    !isPublicContentPage(pathWithoutLocale)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  if (sessionCookie && isAuthPage(pathWithoutLocale)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
