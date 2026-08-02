import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { assertCanEdit, requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import { createSpending } from "@/server/services/event-spending-service";
import { EventSpendingCategory } from "@/types/enums";

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, "Enter a positive number");

const createBodySchema = z.object({
  title: z.string().min(1).max(200),
  category: zodEnumFromConst(EventSpendingCategory).default(
    EventSpendingCategory.Other,
  ),
  amount: decimalString,
  amountUnit: z.string().min(1).max(20),
  price: decimalString,
  note: z.string().max(1000).nullish(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    assertCanEdit(access.viewer);
    const body = createBodySchema.parse(await request.json());
    const spendingId = await createSpending({
      eventId: id,
      author: {
        userId: access.viewer.userId,
        guestUserId: access.viewer.guestUserId,
      },
      title: body.title,
      category: body.category,
      amount: body.amount,
      amountUnit: body.amountUnit,
      price: body.price,
      note: body.note,
    });
    return jsonOk({ spendingId }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
