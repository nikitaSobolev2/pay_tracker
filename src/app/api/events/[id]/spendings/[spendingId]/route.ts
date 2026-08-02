import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { assertCanEdit, requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import {
  deleteSpending,
  updateSpending,
} from "@/server/services/event-spending-service";
import { EventSpendingCategory } from "@/types/enums";

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, "Enter a positive number");

const updateBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: zodEnumFromConst(EventSpendingCategory).optional(),
  amount: decimalString.optional(),
  amountUnit: z.string().min(1).max(20).optional(),
  price: decimalString.optional(),
  note: z.string().max(1000).nullish(),
});

type RouteContext = {
  params: Promise<{ id: string; spendingId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id, spendingId } = await context.params;
    const access = await requireEventAccess(id);
    assertCanEdit(access.viewer);
    const body = updateBodySchema.parse(await request.json());
    await updateSpending({ eventId: id, spendingId, ...body });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id, spendingId } = await context.params;
    const access = await requireEventAccess(id);
    assertCanEdit(access.viewer);
    await deleteSpending({ eventId: id, spendingId });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
