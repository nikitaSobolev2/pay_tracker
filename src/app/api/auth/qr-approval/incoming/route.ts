import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { listIncomingApprovals } from "@/server/services/qr-approval-service";

/** Owner-only: pending push-flow approvals bound to the current user. */
export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk({ approvals: await listIncomingApprovals(user.id) });
  } catch (error) {
    return handleRouteError(error);
  }
}
