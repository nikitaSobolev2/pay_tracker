import { jsonOk, validationError } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { getApprovalStatus } from "@/server/services/qr-approval-service";

/** Public: the waiting device polls its own request by token. */
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return validationError("token is required");
    }
    return jsonOk(await getApprovalStatus(token));
  } catch (error) {
    return handleRouteError(error);
  }
}
