import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import {
  deletePlannedSpending,
  updatePlannedSpending,
} from "@/server/services/travel-service";
import { TravelPlannedCategory } from "@/types/enums";

const updateBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: zodEnumFromConst(TravelPlannedCategory).optional(),
  amount: z.string().min(1).max(40).optional(),
  note: z.string().max(2000).nullish(),
});

type RouteContext = {
  params: Promise<{ id: string; spendingId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id, spendingId } = await context.params;
    const body = updateBodySchema.parse(await request.json());
    const spending = await updatePlannedSpending({
      userId: user.id,
      travelId: id,
      spendingId,
      title: body.title,
      category: body.category,
      amount: body.amount,
      note: body.note,
    });
    return jsonOk({ spending });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id, spendingId } = await context.params;
    await deletePlannedSpending({
      userId: user.id,
      travelId: id,
      spendingId,
    });
    return jsonOk({ ok: true as const });
  } catch (error) {
    return handleRouteError(error);
  }
}
