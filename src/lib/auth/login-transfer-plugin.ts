import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { z } from "zod";

import {
  createRedeemRateLimiter,
  resolveClientKey,
} from "@/lib/auth/redeem-rate-limit";
import { isAppServiceError } from "@/lib/errors";
import { beginTransferApproval } from "@/server/services/login-transfer-service";

const redeemBodySchema = z
  .object({
    code: z.string().optional(),
    token: z.string().optional(),
    locale: z.string().min(2).max(8).optional(),
  })
  .refine((value) => Boolean(value.code || value.token), {
    message: "code or token is required",
  });

const assertRedeemAllowed = createRedeemRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxAttempts: 10,
});

/**
 * Public endpoint where a device claims a code/QR minted on a logged-in device.
 * The claim no longer signs in immediately: it creates a pending approval that
 * the code owner must confirm, and returns the approval token to poll.
 */
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
            const approval = await beginTransferApproval({
              code: ctx.body.code,
              token: ctx.body.token,
              locale: ctx.body.locale ?? "en",
              requesterUserAgent: ctx.headers?.get("user-agent") ?? null,
              requesterIp: resolveClientKey(ctx.headers),
            });
            return ctx.json({ pending: true as const, token: approval.token });
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
