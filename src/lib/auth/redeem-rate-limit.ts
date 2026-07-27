import { APIError } from "better-auth/api";

/**
 * In-memory per-instance limiter that throttles brute-force guessing on public
 * redeem endpoints. Keyed by client IP.
 */
export function createRedeemRateLimiter(options: {
  readonly windowMs: number;
  readonly maxAttempts: number;
}) {
  const attempts = new Map<string, { count: number; resetAt: number }>();

  return function assertAllowed(clientKey: string): void {
    const now = Date.now();
    const entry = attempts.get(clientKey);
    if (!entry || entry.resetAt <= now) {
      attempts.set(clientKey, { count: 1, resetAt: now + options.windowMs });
      return;
    }
    entry.count += 1;
    if (entry.count > options.maxAttempts) {
      throw new APIError("TOO_MANY_REQUESTS", {
        message: "Too many login attempts. Try again later.",
        code: "LOGIN_TRANSFER_RATE_LIMITED",
      });
    }
  };
}

export function resolveClientKey(headers: Headers | undefined): string {
  const forwardedFor = headers?.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  return headers?.get("x-real-ip")?.trim() || "unknown";
}
