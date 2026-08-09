import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import { upsertCategoryBudget } from "@/server/services/travel-service";
import { TravelPlannedCategory } from "@/types/enums";

const bodySchema = z.object({
  category: zodEnumFromConst(TravelPlannedCategory),
  amount: z.string().max(40).nullish(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = bodySchema.parse(await request.json());
    const budget = await upsertCategoryBudget({
      userId: user.id,
      travelId: id,
      category: body.category,
      amount: body.amount ?? null,
    });
    return jsonOk({ budget });
  } catch (error) {
    return handleRouteError(error);
  }
}
