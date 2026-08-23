import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { divideTransaction } from "@/server/services/transaction-divide-service";

const shareSchema = z.object({
  counterpartyName: z.string().min(1).max(200),
  amount: z.string().min(1),
});

const bodySchema = z.object({
  shares: z.array(shareSchema).min(1).max(50),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = bodySchema.parse(await request.json());
    const transaction = await divideTransaction({
      userId: user.id,
      displayCurrency: user.defaultCurrency,
      transactionId: id,
      shares: body.shares,
    });
    return jsonOk({ transaction });
  } catch (error) {
    return handleRouteError(error);
  }
}
