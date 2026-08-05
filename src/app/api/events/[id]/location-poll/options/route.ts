import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { addPollOption } from "@/server/services/event-location-poll-service";

const optionSchema = z.object({
  title: z.string().min(1).max(200),
  link: z.string().url().max(2000).nullish().or(z.literal("")),
  address: z.string().max(500).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
});

const bodySchema = z.object({
  pollId: z.string().min(1),
  option: optionSchema,
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    const body = bodySchema.parse(await request.json());
    const poll = await addPollOption({
      eventId: id,
      pollId: body.pollId,
      option: {
        title: body.option.title,
        link: body.option.link || null,
        address: body.option.address,
        latitude: body.option.latitude,
        longitude: body.option.longitude,
      },
      author: {
        userId: access.viewer.userId,
        guestUserId: access.viewer.guestUserId,
      },
      viewer: access.viewer,
    });
    return jsonOk({ poll }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
