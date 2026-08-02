import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { assertCanEdit, requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { addAttendee } from "@/server/services/event-service";

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
    assertCanEdit(access.viewer);
    const body = createBodySchema.parse(await request.json());
    const attendee = await addAttendee({
      eventId: id,
      ownerUserId: access.event.userId,
      counterpartyId: body.counterpartyId,
      name: body.name,
    });
    return jsonOk({ attendee }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
