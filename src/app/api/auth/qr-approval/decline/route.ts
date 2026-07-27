import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { declineApproval } from "@/server/services/qr-approval-service";

const bodySchema = z
  .object({
    token: z.string().optional(),
    id: z.string().optional(),
  })
  .refine((value) => Boolean(value.token || value.id), {
    message: "token or id is required",
  });

/** Approver-only: reject a sign-in request. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await request.json());
    await declineApproval({
      token: body.token,
      id: body.id,
      approverUserId: user.id,
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
