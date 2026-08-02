import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { assertCanEdit, requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import {
  removeAttendee,
  updateAttendeeStatus,
} from "@/server/services/event-service";
import { EventAttendanceStatus } from "@/types/enums";

const updateBodySchema = z.object({
  status: zodEnumFromConst(EventAttendanceStatus),
});

type RouteContext = {
  params: Promise<{ id: string; attendeeId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id, attendeeId } = await context.params;
    const access = await requireEventAccess(id);
    assertCanEdit(access.viewer);
    const body = updateBodySchema.parse(await request.json());
    await updateAttendeeStatus({ eventId: id, attendeeId, status: body.status });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id, attendeeId } = await context.params;
    const access = await requireEventAccess(id);
    assertCanEdit(access.viewer);
    await removeAttendee({ eventId: id, attendeeId });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
