import { jsonOk } from "@/lib/api-response";
import { requireEventAccess } from "@/lib/event-access";
import { messageAttachmentBodySchema } from "@/lib/message-attachment-schema";
import { handleRouteError } from "@/lib/route-handler";
import { createComment } from "@/server/services/event-thread-service";

const createBodySchema = messageAttachmentBodySchema;

type RouteContext = {
  params: Promise<{ id: string; threadId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id, threadId } = await context.params;
    const access = await requireEventAccess(id);
    const payload = createBodySchema.parse(await request.json());
    const commentId = await createComment({
      eventId: id,
      threadId,
      viewer: access.viewer,
      body: payload.body,
      imageUrl: payload.imageUrl,
    });
    return jsonOk({ commentId }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
