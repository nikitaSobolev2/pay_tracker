import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { assertCanManagePayments, requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { createPayment } from "@/server/services/event-spending-service";
import { getEventSettlement } from "@/server/services/event-service";

const createBodySchema = z.object({
  attendeeId: z.string().min(1),
  amount: z.string().regex(/^\d+$/, "Enter a whole number"),
  paidAt: z.iso.datetime().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireEventAccess(id);
    const settlement = await getEventSettlement(id);
    return jsonOk({ payments: settlement.payments });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    assertCanManagePayments(access.viewer);
    const body = createBodySchema.parse(await request.json());
    await createPayment({
      eventId: id,
      attendeeId: body.attendeeId,
      amount: body.amount,
      paidAt: body.paidAt ? new Date(body.paidAt) : undefined,
    });
    const settlement = await getEventSettlement(id);
    return jsonOk(settlement, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
