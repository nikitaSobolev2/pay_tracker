import { jsonOk } from "@/lib/api-response";
import { requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { deleteComment } from "@/server/services/event-thread-service";

type RouteContext = {
  params: Promise<{ id: string; threadId: string; commentId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id, threadId, commentId } = await context.params;
    const access = await requireEventAccess(id);
    await deleteComment({
      eventId: id,
      threadId,
      commentId,
      viewer: access.viewer,
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
