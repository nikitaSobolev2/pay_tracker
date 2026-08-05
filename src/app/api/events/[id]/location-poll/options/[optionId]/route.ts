import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import {
  deletePollOption,
  updatePollOption,
} from "@/server/services/event-location-poll-service";

const optionSchema = z.object({
  title: z.string().min(1).max(200),
  link: z.string().url().max(2000).nullish().or(z.literal("")),
  address: z.string().max(500).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
});

const patchBodySchema = z.object({
  pollId: z.string().min(1),
  option: optionSchema,
});

type RouteContext = {
  params: Promise<{ id: string; optionId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id, optionId } = await context.params;
    const access = await requireEventAccess(id);
    const body = patchBodySchema.parse(await request.json());
    const poll = await updatePollOption({
      eventId: id,
      pollId: body.pollId,
      optionId,
      option: {
        title: body.option.title,
        link: body.option.link || null,
        address: body.option.address,
        latitude: body.option.latitude,
        longitude: body.option.longitude,
      },
      viewer: access.viewer,
    });
    return jsonOk({ poll });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id, optionId } = await context.params;
    const access = await requireEventAccess(id);
    const url = new URL(request.url);
    const pollId = url.searchParams.get("pollId");
    if (!pollId) {
      const body = z
        .object({ pollId: z.string().min(1) })
        .parse(await request.json().catch(() => ({})));
      const poll = await deletePollOption({
        eventId: id,
        pollId: body.pollId,
        optionId,
        viewer: access.viewer,
      });
      return jsonOk({ poll });
    }
    const poll = await deletePollOption({
      eventId: id,
      pollId,
      optionId,
      viewer: access.viewer,
    });
    return jsonOk({ poll });
  } catch (error) {
    return handleRouteError(error);
  }
}
