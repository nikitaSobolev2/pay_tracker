import { jsonOk, validationError } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { getApprovalInfo } from "@/server/services/qr-approval-service";

/** Approver-only: describe the requesting device before approving. */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return validationError("token is required");
    }
    return jsonOk(await getApprovalInfo(token, user.id));
  } catch (error) {
    return handleRouteError(error);
  }
}
