import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import {
  deleteTravelTicket,
  updateTravelTicket,
} from "@/server/services/travel-service";

const updateBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

type RouteContext = {
  params: Promise<{ id: string; ticketId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id, ticketId } = await context.params;
    const body = updateBodySchema.parse(await request.json());
    const ticket = await updateTravelTicket({
      userId: user.id,
      travelId: id,
      ticketId,
      title: body.title,
    });
    return jsonOk({ ticket });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id, ticketId } = await context.params;
    await deleteTravelTicket({
      userId: user.id,
      travelId: id,
      ticketId,
    });
    return jsonOk({ ok: true as const });
  } catch (error) {
    return handleRouteError(error);
  }
}
