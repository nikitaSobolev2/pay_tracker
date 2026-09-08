import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import {
  deleteCalculatorBoard,
  getCalculatorBoard,
  updateCalculatorBoard,
} from "@/server/services/calculator-board-service";

const updateBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  query: z.unknown().optional(),
  session: z.unknown().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const board = await getCalculatorBoard({ userId: user.id, id });
    return jsonOk({ board });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = updateBodySchema.parse(await request.json());
    const board = await updateCalculatorBoard({
      userId: user.id,
      id,
      title: body.title,
      query: body.query,
      session: body.session,
    });
    return jsonOk({ board });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteCalculatorBoard({ userId: user.id, id });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
