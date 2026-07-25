import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { bulkDeleteTransactions } from "@/server/services/transaction-service";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await request.json());
    const result = await bulkDeleteTransactions({
      userId: user.id,
      ids: body.ids,
    });
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
