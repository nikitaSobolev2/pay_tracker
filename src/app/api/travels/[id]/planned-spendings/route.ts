import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import { createPlannedSpending } from "@/server/services/travel-service";
import { TravelPlannedCategory } from "@/types/enums";

const createBodySchema = z.object({
  title: z.string().min(1).max(200),
  category: zodEnumFromConst(TravelPlannedCategory),
  amount: z.string().min(1).max(40),
  note: z.string().max(2000).nullish(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = createBodySchema.parse(await request.json());
    const spending = await createPlannedSpending({
      userId: user.id,
      travelId: id,
      title: body.title,
      category: body.category,
      amount: body.amount,
      note: body.note,
    });
    return jsonOk({ spending }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
