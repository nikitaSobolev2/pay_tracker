import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { AppServiceError } from "@/lib/errors";
import { requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { claimEventAttendee } from "@/server/services/event-location-poll-service";
import { ApiErrorCode } from "@/types/api";
import { EventAuthorRole } from "@/types/enums";

const bodySchema = z.object({
  attendeeId: z.string().min(1),
  name: z.string().min(1).max(60),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    if (access.viewer.role !== EventAuthorRole.Guest || !access.viewer.guestUserId) {
      throw new AppServiceError(
        ApiErrorCode.Forbidden,
        "Only guests can claim an attendee",
      );
    }
    const body = bodySchema.parse(await request.json());
    const result = await claimEventAttendee({
      eventId: id,
      guestUserId: access.viewer.guestUserId,
      attendeeId: body.attendeeId,
      name: body.name,
    });
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
