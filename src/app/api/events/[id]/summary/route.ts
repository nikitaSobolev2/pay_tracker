import { jsonOk } from "@/lib/api-response";
import { requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { getEventSettlement } from "@/server/services/event-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireEventAccess(id);
    const settlement = await getEventSettlement(id);
    return jsonOk(settlement);
  } catch (error) {
    return handleRouteError(error);
  }
}
