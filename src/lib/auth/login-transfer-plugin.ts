import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

import { isAppServiceError } from "@/lib/errors";
import { redeemLoginTransfer } from "@/server/services/login-transfer-service";

const redeemBodySchema = z
  .object({
    code: z.string().optional(),
    token: z.string().optional(),
  })
  .refine((value) => Boolean(value.code || value.token), {
    message: "code or token is required",
  });

const REDEEM_WINDOW_MS = 5 * 60 * 1000;
const REDEEM_MAX_ATTEMPTS = 10;
const redeemAttempts = new Map<string, { count: number; resetAt: number }>();

/**
 * Throttles brute-force guessing of six-digit codes on the public redeem
 * endpoint. In-memory per-instance limiter keyed by client IP.
 */
function assertRedeemAllowed(clientKey: string): void {
  const now = Date.now();
  const entry = redeemAttempts.get(clientKey);
  if (!entry || entry.resetAt <= now) {
    redeemAttempts.set(clientKey, { count: 1, resetAt: now + REDEEM_WINDOW_MS });
    return;
  }
  entry.count += 1;
  if (entry.count > REDEEM_MAX_ATTEMPTS) {
    throw new APIError("TOO_MANY_REQUESTS", {
      message: "Too many login attempts. Try again later.",
      code: "LOGIN_TRANSFER_RATE_LIMITED",
    });
  }
}

function resolveClientKey(headers: Headers | undefined): string {
  const forwardedFor = headers?.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  return headers?.get("x-real-ip")?.trim() || "unknown";
}

export function loginTransferPlugin(): BetterAuthPlugin {
  return {
    id: "login-transfer",
    endpoints: {
      redeemLoginTransfer: createAuthEndpoint(
        "/login-transfer/redeem",
        {
          method: "POST",
          body: redeemBodySchema,
        },
        async (ctx) => {
          assertRedeemAllowed(resolveClientKey(ctx.headers));
          try {
            const redeemed = await redeemLoginTransfer({
              code: ctx.body.code,
              token: ctx.body.token,
            });
            const session = await ctx.context.internalAdapter.createSession(
              redeemed.userId,
            );
            if (!session) {
              throw APIError.from("INTERNAL_SERVER_ERROR", {
                message: "Failed to create session",
                code: "FAILED_TO_CREATE_SESSION",
              });
            }
            const user = await ctx.context.internalAdapter.findUserById(
              redeemed.userId,
            );
            if (!user) {
              throw APIError.from("INTERNAL_SERVER_ERROR", {
                message: "User not found",
                code: "USER_NOT_FOUND",
              });
            }
            await setSessionCookie(ctx, { session, user });
            return ctx.json({ ok: true as const });
          } catch (error) {
            if (isAppServiceError(error)) {
              throw APIError.from("BAD_REQUEST", {
                message: error.message,
                code: error.code,
              });
            }
            throw error;
          }
        },
      ),
    },
  };
}
