import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import {
  deleteCounterparty,
  updateCounterparty,
} from "@/server/services/counterparty-service";

const updateBodySchema = z.object({
  name: z.string().min(1).max(120),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = updateBodySchema.parse(await request.json());
    const counterparty = await updateCounterparty({
      userId: user.id,
      counterpartyId: id,
      name: body.name,
    });
    return jsonOk({ counterparty });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteCounterparty({
      userId: user.id,
      counterpartyId: id,
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
