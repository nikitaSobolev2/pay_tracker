import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { requireEventAccess } from "@/lib/event-access";
import { AppServiceError } from "@/lib/errors";
import { handleRouteError } from "@/lib/route-handler";
import { addAttendee } from "@/server/services/event-service";
import { ApiErrorCode } from "@/types/api";
import { EventAuthorRole } from "@/types/enums";

const createBodySchema = z
  .object({
    counterpartyId: z.string().optional(),
    name: z.string().min(1).max(200).optional(),
  })
  .refine((body) => Boolean(body.counterpartyId ?? body.name), {
    message: "Person is required",
  });

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    if (
      access.viewer.role !== EventAuthorRole.Owner &&
      access.viewer.role !== EventAuthorRole.Guest
    ) {
      throw new AppServiceError(
        ApiErrorCode.Forbidden,
        "You cannot add people to this event",
      );
    }
    const body = createBodySchema.parse(await request.json());
    const attendee = await addAttendee({
      eventId: id,
      ownerUserId: access.event.userId,
      counterpartyId: body.counterpartyId,
      name: body.name,
      authorUserId: access.viewer.userId,
      authorGuestId: access.viewer.guestUserId,
    });
    return jsonOk({ attendee }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
