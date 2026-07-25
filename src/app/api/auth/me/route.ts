import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";

export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
