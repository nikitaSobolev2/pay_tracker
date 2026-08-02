import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { pollEventLive } from "@/server/services/event-live-service";

const pollBodySchema = z.object({
  chatAfterId: z.string().nullish(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    const body = pollBodySchema.parse(await request.json().catch(() => ({})));
    const live = await pollEventLive({
      eventId: id,
      viewer: access.viewer,
      chatAfterId: body.chatAfterId,
    });
    return jsonOk(live);
  } catch (error) {
    return handleRouteError(error);
  }
}
