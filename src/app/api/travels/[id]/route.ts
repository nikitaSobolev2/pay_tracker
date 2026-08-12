import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import {
  deleteTravel,
  getTravelDetail,
  updateTravel,
} from "@/server/services/travel-service";
import { TravelPhase } from "@/types/enums";

const updateBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  startsAt: z.iso.datetime().optional(),
  endsAt: z.iso.datetime().optional(),
  imageUrl: z.string().url().max(2000).nullish(),
  placeCountry: z.string().max(120).nullish(),
  placeCity: z.string().max(120).nullish(),
  placeLabel: z.string().max(240).nullish(),
  housingAddress: z.string().max(500).nullish(),
  housingLatitude: z.number().min(-90).max(90).nullish(),
  housingLongitude: z.number().min(-180).max(180).nullish(),
  housingFloor: z.string().max(40).nullish(),
  housingEntrance: z.string().max(40).nullish(),
  housingApartment: z.string().max(40).nullish(),
  maxSpendingGoal: z.string().max(40).nullish(),
  phaseOverride: zodEnumFromConst(TravelPhase).nullish(),
  clearPhaseOverride: z.boolean().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const travel = await getTravelDetail(user.id, id);
    return jsonOk({ travel });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = updateBodySchema.parse(await request.json());
    await updateTravel({
      userId: user.id,
      travelId: id,
      title: body.title,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      imageUrl: body.imageUrl,
      placeCountry: body.placeCountry,
      placeCity: body.placeCity,
      placeLabel: body.placeLabel,
      housingAddress: body.housingAddress,
      housingLatitude: body.housingLatitude,
      housingLongitude: body.housingLongitude,
      housingFloor: body.housingFloor,
      housingEntrance: body.housingEntrance,
      housingApartment: body.housingApartment,
      maxSpendingGoal: body.maxSpendingGoal,
      phaseOverride: body.phaseOverride,
      clearPhaseOverride: body.clearPhaseOverride,
    });
    const travel = await getTravelDetail(user.id, id);
    return jsonOk({ travel });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteTravel(user.id, id);
    return jsonOk({ ok: true as const });
  } catch (error) {
    return handleRouteError(error);
  }
}
