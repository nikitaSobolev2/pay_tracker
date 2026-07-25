import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { deleteAccount } from "@/server/services/user-settings-service";

export async function DELETE() {
  try {
    const user = await requireUser();
    await deleteAccount(user.id);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
