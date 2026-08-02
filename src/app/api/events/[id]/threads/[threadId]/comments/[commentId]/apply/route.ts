import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { requireEventOwnerAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import { applySuggestion } from "@/server/services/event-ai-suggestion-service";
import { EventSpendingField } from "@/types/enums";

type RouteContext = {
  params: Promise<{ id: string; threadId: string; commentId: string }>;
};

const bodySchema = z.object({
  field: zodEnumFromConst(EventSpendingField),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id, threadId, commentId } = await context.params;
    await requireEventOwnerAccess(id);
    const body = bodySchema.parse(await request.json());
    await applySuggestion({
      eventId: id,
      threadId,
      commentId,
      field: body.field,
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
