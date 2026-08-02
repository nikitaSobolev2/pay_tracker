import { cookies, headers } from "next/headers";

export const GUEST_COOKIE_NAME = "pt_guest";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export async function readGuestIdCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(GUEST_COOKIE_NAME)?.value ?? null;
}

export async function writeGuestIdCookie(guestUserId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(GUEST_COOKIE_NAME, guestUserId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS,
  });
}

export type GuestRequestInfo = {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
};

export async function readGuestRequestInfo(): Promise<GuestRequestInfo> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  return {
    ipAddress: forwardedFor?.split(",")[0]?.trim() ?? null,
    userAgent: requestHeaders.get("user-agent"),
  };
}
