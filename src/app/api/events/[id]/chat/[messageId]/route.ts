import { jsonOk } from "@/lib/api-response";
import { requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { deleteMessage } from "@/server/services/event-chat-service";

type RouteContext = {
  params: Promise<{ id: string; messageId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id, messageId } = await context.params;
    const access = await requireEventAccess(id);
    await deleteMessage({ eventId: id, messageId, viewer: access.viewer });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
