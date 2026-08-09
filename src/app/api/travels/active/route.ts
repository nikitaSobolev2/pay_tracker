import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { getActiveTravel } from "@/server/services/travel-service";

export async function GET() {
  try {
    const user = await requireUser();
    const travel = await getActiveTravel(user.id);
    return jsonOk({ travel });
  } catch (error) {
    return handleRouteError(error);
  }
}
