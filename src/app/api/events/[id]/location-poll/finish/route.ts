import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { assertIsOwner, requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { finishLocationPoll } from "@/server/services/event-location-poll-service";

const bodySchema = z.object({
  pollId: z.string().min(1),
  optionId: z.string().min(1).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    assertIsOwner(access.viewer);
    const body = bodySchema.parse(await request.json());
    const result = await finishLocationPoll({
      eventId: id,
      pollId: body.pollId,
      chosenOptionId: body.optionId,
    });
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
