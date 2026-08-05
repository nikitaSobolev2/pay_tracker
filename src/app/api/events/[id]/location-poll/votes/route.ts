import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { setPollVotes } from "@/server/services/event-location-poll-service";

const bodySchema = z.object({
  pollId: z.string().min(1),
  optionIds: z.array(z.string().min(1)).max(20),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    const body = bodySchema.parse(await request.json());
    const poll = await setPollVotes({
      eventId: id,
      pollId: body.pollId,
      optionIds: body.optionIds,
      viewer: access.viewer,
    });
    return jsonOk({ poll });
  } catch (error) {
    return handleRouteError(error);
  }
}
