import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { assertCanManagePayments, requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import {
  deletePayment,
  updatePayment,
} from "@/server/services/event-spending-service";
import { getEventSettlement } from "@/server/services/event-service";

const updateBodySchema = z.object({
  amount: z.string().regex(/^\d+$/, "Enter a whole number"),
});

type RouteContext = {
  params: Promise<{ id: string; paymentId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id, paymentId } = await context.params;
    const access = await requireEventAccess(id);
    assertCanManagePayments(access.viewer);
    const body = updateBodySchema.parse(await request.json());
    await updatePayment({ eventId: id, paymentId, amount: body.amount });
    const settlement = await getEventSettlement(id);
    return jsonOk(settlement);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id, paymentId } = await context.params;
    const access = await requireEventAccess(id);
    assertCanManagePayments(access.viewer);
    await deletePayment({ eventId: id, paymentId });
    const settlement = await getEventSettlement(id);
    return jsonOk(settlement);
  } catch (error) {
    return handleRouteError(error);
  }
}
