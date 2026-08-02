import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { ensureCurrentGuest } from "@/lib/event-access";
import { AppServiceError } from "@/lib/errors";
import { readGuestIdCookie } from "@/lib/guest-session";
import { handleRouteError } from "@/lib/route-handler";
import { renameGuestUser } from "@/server/services/guest-user-service";
import { ApiErrorCode } from "@/types/api";

const renameBodySchema = z.object({
  name: z.string().min(1).max(60),
});

export async function POST() {
  try {
    const guest = await ensureCurrentGuest();
    return jsonOk({ guest });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const guestUserId = await readGuestIdCookie();
    if (!guestUserId) {
      throw new AppServiceError(ApiErrorCode.NotFound, "Guest not found");
    }
    const body = renameBodySchema.parse(await request.json());
    const guest = await renameGuestUser({ guestUserId, name: body.name });
    return jsonOk({ guest });
  } catch (error) {
    return handleRouteError(error);
  }
}
