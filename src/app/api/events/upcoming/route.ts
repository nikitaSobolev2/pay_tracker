import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { getNearestUpcomingEvent } from "@/server/services/event-service";

export async function GET() {
  try {
    const user = await requireUser();
    const event = await getNearestUpcomingEvent(user.id);
    return jsonOk({ event });
  } catch (error) {
    return handleRouteError(error);
  }
}
