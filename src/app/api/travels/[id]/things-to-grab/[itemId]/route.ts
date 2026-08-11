import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import {
  deleteThingToGrab,
  updateThingToGrab,
} from "@/server/services/travel-service";

const updateBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  amount: z.number().int().min(1).max(9999).optional(),
  isChecked: z.boolean().optional(),
});

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id, itemId } = await context.params;
    const body = updateBodySchema.parse(await request.json());
    const item = await updateThingToGrab({
      userId: user.id,
      travelId: id,
      itemId,
      title: body.title,
      amount: body.amount,
      isChecked: body.isChecked,
    });
    return jsonOk({ item });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id, itemId } = await context.params;
    await deleteThingToGrab({
      userId: user.id,
      travelId: id,
      itemId,
    });
    return jsonOk({ ok: true as const });
  } catch (error) {
    return handleRouteError(error);
  }
}
