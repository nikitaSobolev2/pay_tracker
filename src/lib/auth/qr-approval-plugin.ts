import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

import {
  createRedeemRateLimiter,
  resolveClientKey,
} from "@/lib/auth/redeem-rate-limit";
import { isAppServiceError } from "@/lib/errors";
import { redeemApproval } from "@/server/services/qr-approval-service";

const redeemBodySchema = z.object({
  token: z.string().min(1),
});

const assertRedeemAllowed = createRedeemRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxAttempts: 20,
});

/**
 * Public endpoint the waiting device calls once its request is approved. It
 * exchanges the one-time approval token for a real session cookie.
 */
export function qrApprovalPlugin(): BetterAuthPlugin {
  return {
    id: "qr-approval",
    endpoints: {
      redeemQrApproval: createAuthEndpoint(
        "/qr-approval/redeem",
        {
          method: "POST",
          body: redeemBodySchema,
        },
        async (ctx) => {
          assertRedeemAllowed(resolveClientKey(ctx.headers));
          try {
            const redeemed = await redeemApproval(ctx.body.token);
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
            // Native clients (macOS widget) read `token` or `set-auth-token`.
            return ctx.json({ ok: true as const, token: session.token });
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
