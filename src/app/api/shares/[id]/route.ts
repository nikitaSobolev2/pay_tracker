import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { getSessionUser, requireUser } from "@/lib/session";
import {
  deleteSharedChart,
  getSharedChartForViewer,
  updateSharedChart,
} from "@/server/services/shared-chart-service";

const patchSchema = z.object({
  title: z.string().max(120).nullable().optional(),
  isPublic: z.boolean().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const sessionUser = await getSessionUser();
    const share = await getSharedChartForViewer({
      id,
      viewerUserId: sessionUser?.id,
    });
    return jsonOk(share);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());
    const share = await updateSharedChart({
      userId: user.id,
      id,
      title: body.title,
      isPublic: body.isPublic,
    });
    return jsonOk(share);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteSharedChart(user.id, id);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
