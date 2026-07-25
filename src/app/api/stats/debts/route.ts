import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { getDebtsStats } from "@/server/services/stats-service";

export async function GET() {
  try {
    const user = await requireUser();
    const stats = await getDebtsStats({
      userId: user.id,
      timezone: user.timezone,
      displayCurrency: user.defaultCurrency,
    });
    return jsonOk(stats);
  } catch (error) {
    return handleRouteError(error);
  }
}
