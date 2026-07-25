import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { getDebtDetailStats } from "@/server/services/detail-stats-service";

type RouteContext = {
  params: Promise<{ counterpartyId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { counterpartyId } = await context.params;
    const stats = await getDebtDetailStats({
      userId: user.id,
      counterpartyId,
      displayCurrency: user.defaultCurrency,
      timezone: user.timezone,
    });
    return jsonOk({ stats });
  } catch (error) {
    return handleRouteError(error);
  }
}
