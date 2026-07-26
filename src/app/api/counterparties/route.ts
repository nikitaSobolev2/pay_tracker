import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import {
  createCounterparty,
  listAllCounterparties,
  searchCounterparties,
} from "@/server/services/counterparty-service";
import { TransactionDebtRole } from "@/types/enums";

const querySchema = z.object({
  debtRole: zodEnumFromConst(TransactionDebtRole).optional(),
  q: z.string().optional(),
  all: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((value) => value === "true" || value === "1"),
});

const createBodySchema = z.object({
  name: z.string().min(1).max(200),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      debtRole: searchParams.get("debtRole") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      all: searchParams.get("all") ?? undefined,
    });

    const counterparties = query.all
      ? await listAllCounterparties({ userId: user.id })
      : await searchCounterparties({
          userId: user.id,
          debtRole: query.debtRole,
          q: query.q,
        });

    return jsonOk({ counterparties });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createBodySchema.parse(await request.json());
    const counterparty = await createCounterparty({
      userId: user.id,
      name: body.name,
    });
    return jsonOk({ counterparty }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
