import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { assertIsOwner, requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import {
  deleteThread,
  setThreadResolved,
} from "@/server/services/event-thread-service";

const updateBodySchema = z.object({
  resolved: z.boolean(),
});

type RouteContext = {
  params: Promise<{ id: string; threadId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id, threadId } = await context.params;
    await requireEventAccess(id);
    const body = updateBodySchema.parse(await request.json());
    await setThreadResolved({ eventId: id, threadId, resolved: body.resolved });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id, threadId } = await context.params;
    const access = await requireEventAccess(id);
    assertIsOwner(access.viewer);
    await deleteThread({ eventId: id, threadId });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
