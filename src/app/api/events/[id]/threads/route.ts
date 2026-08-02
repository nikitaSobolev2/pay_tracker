import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import {
  createThread,
  listThreads,
} from "@/server/services/event-thread-service";

const createBodySchema = z.object({
  spendingId: z.string().min(1),
  body: z.string().min(1).max(2000),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    const spendingId =
      new URL(request.url).searchParams.get("spendingId") ?? undefined;
    const threads = await listThreads({
      eventId: id,
      spendingId,
      viewer: access.viewer,
    });
    return jsonOk({ threads });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    const body = createBodySchema.parse(await request.json());
    await createThread({
      eventId: id,
      spendingId: body.spendingId,
      viewer: access.viewer,
      body: body.body,
    });
    const threads = await listThreads({
      eventId: id,
      spendingId: body.spendingId,
      viewer: access.viewer,
    });
    return jsonOk({ threads }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
