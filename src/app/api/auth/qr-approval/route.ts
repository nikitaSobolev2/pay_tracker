import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { resolveClientKey } from "@/lib/auth/redeem-rate-limit";
import { handleRouteError } from "@/lib/route-handler";
import { createApproval } from "@/server/services/qr-approval-service";

const bodySchema = z.object({
  locale: z.string().min(2).max(8).optional(),
});

/** Public: an unauthenticated device mints its own approval request. */
export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const baseUrl =
      process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ??
      new URL(request.url).origin;
    const approval = await createApproval({
      locale: body.locale ?? "en",
      baseUrl,
      requesterUserAgent: request.headers.get("user-agent"),
      requesterIp: resolveClientKey(request.headers),
    });
    return jsonOk(approval);
  } catch (error) {
    return handleRouteError(error);
  }
}
