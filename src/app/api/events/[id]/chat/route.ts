import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { listMessages, postMessage } from "@/server/services/event-chat-service";

const createBodySchema = z.object({
  body: z.string().min(1).max(2000),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    const afterId = new URL(request.url).searchParams.get("afterId");
    const messages = await listMessages({
      eventId: id,
      viewer: access.viewer,
      afterId,
    });
    return jsonOk({ messages });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    const payload = createBodySchema.parse(await request.json());
    const messageId = await postMessage({
      eventId: id,
      viewer: access.viewer,
      body: payload.body,
    });
    return jsonOk({ messageId }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
