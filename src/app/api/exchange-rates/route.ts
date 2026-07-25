import { jsonOk } from "@/lib/api-response";
import { getDefaultCurrencies } from "@/lib/env";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { listLatestRatesToRub } from "@/server/services/exchange-rate-service";

export async function GET() {
  try {
    await requireUser();
    const rates = await listLatestRatesToRub(getDefaultCurrencies());
    return jsonOk({ rates });
  } catch (error) {
    return handleRouteError(error);
  }
}
