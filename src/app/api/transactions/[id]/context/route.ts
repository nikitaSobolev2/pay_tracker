import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { getTransactionWithCategoryContext } from "@/server/services/detail-stats-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const payload = await getTransactionWithCategoryContext({
      userId: user.id,
      transactionId: id,
      displayCurrency: user.defaultCurrency,
      timezone: user.timezone,
    });
    return jsonOk(payload);
  } catch (error) {
    return handleRouteError(error);
  }
}
