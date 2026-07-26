import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import { suggestTransactionsByTitle } from "@/server/services/transaction-service";
import { TransactionType } from "@/types/enums";

const querySchema = z.object({
  q: z.string().min(1).max(200),
  type: zodEnumFromConst(TransactionType).optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      q: searchParams.get("q") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const items = await suggestTransactionsByTitle({
      userId: user.id,
      displayCurrency: user.defaultCurrency,
      query: query.q,
      type: query.type,
      limit: query.limit,
    });
    return jsonOk({ items });
  } catch (error) {
    return handleRouteError(error);
  }
}
