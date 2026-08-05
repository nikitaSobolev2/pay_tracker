import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { assertIsOwner, requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import {
  createLocationPoll,
  deleteLocationPoll,
  updateLocationPoll,
} from "@/server/services/event-location-poll-service";
import { EventPollSelectionMode } from "@/types/enums";

const optionSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1).max(200),
  link: z.string().url().max(2000).nullish().or(z.literal("")),
  address: z.string().max(500).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
});

const createBodySchema = z.object({
  title: z.string().min(1).max(200),
  selectionMode: zodEnumFromConst(EventPollSelectionMode),
  endsAt: z.iso.datetime().nullish(),
  options: z.array(optionSchema).min(1).max(20),
});

const updateBodySchema = createBodySchema.extend({
  pollId: z.string().min(1),
});

const deleteBodySchema = z.object({
  pollId: z.string().min(1),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

function mapOptions(
  options: z.infer<typeof optionSchema>[],
) {
  return options.map((option) => ({
    id: option.id,
    title: option.title,
    link: option.link || null,
    address: option.address,
    latitude: option.latitude,
    longitude: option.longitude,
  }));
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    assertIsOwner(access.viewer);
    const body = createBodySchema.parse(await request.json());
    const poll = await createLocationPoll({
      eventId: id,
      title: body.title,
      selectionMode: body.selectionMode,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      options: mapOptions(body.options),
      author: {
        userId: access.viewer.userId,
        guestUserId: access.viewer.guestUserId,
      },
    });
    return jsonOk({ poll }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    assertIsOwner(access.viewer);
    const body = updateBodySchema.parse(await request.json());
    const poll = await updateLocationPoll({
      eventId: id,
      pollId: body.pollId,
      title: body.title,
      selectionMode: body.selectionMode,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      options: mapOptions(body.options),
      author: {
        userId: access.viewer.userId,
        guestUserId: access.viewer.guestUserId,
      },
    });
    return jsonOk({ poll });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    assertIsOwner(access.viewer);
    const body = deleteBodySchema.parse(await request.json());
    await deleteLocationPoll({ eventId: id, pollId: body.pollId });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
