import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { searchAll } from "@/server/services/search-service";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") ?? "").trim();
    const result = await searchAll({
      userId: user.id,
      displayCurrency: user.defaultCurrency,
      timezone: user.timezone,
      query,
    });
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
