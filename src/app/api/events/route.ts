import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import { createEvent, listEvents } from "@/server/services/event-service";
import { EventGuestPermission, EventPublicity } from "@/types/enums";

const createBodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).nullish(),
  occursAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullish(),
  imageUrl: z.string().url().max(2000).nullish(),
  address: z.string().max(500).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  publicity: zodEnumFromConst(EventPublicity).default(EventPublicity.Private),
  guestPermission: zodEnumFromConst(EventGuestPermission).default(
    EventGuestPermission.View,
  ),
  counterpartyIds: z.array(z.string()).default([]),
});

export async function GET() {
  try {
    const user = await requireUser();
    const events = await listEvents(user.id);
    return jsonOk({ events });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createBodySchema.parse(await request.json());
    const eventId = await createEvent({
      userId: user.id,
      title: body.title,
      description: body.description,
      occursAt: new Date(body.occursAt),
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      imageUrl: body.imageUrl,
      address: body.address,
      latitude: body.latitude,
      longitude: body.longitude,
      publicity: body.publicity,
      guestPermission: body.guestPermission,
      currency: user.defaultCurrency,
      counterpartyIds: body.counterpartyIds,
    });
    return jsonOk({ eventId }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
