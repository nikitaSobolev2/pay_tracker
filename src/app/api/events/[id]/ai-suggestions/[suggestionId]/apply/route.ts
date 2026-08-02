import { jsonOk } from "@/lib/api-response";
import { requireEventOwnerAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { applyMissingItemSuggestion } from "@/server/services/event-ai-suggestion-service";

type RouteContext = {
  params: Promise<{ id: string; suggestionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id, suggestionId } = await context.params;
    const access = await requireEventOwnerAccess(id);
    const result = await applyMissingItemSuggestion({
      eventId: id,
      suggestionId,
      viewer: access.viewer,
    });
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
