import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import { applyImport } from "@/server/services/csv-import-export-service";
import { TransactionDebtRole, TransactionType } from "@/types/enums";

const rowSchema = z.object({
  id: z.string().nullable().optional(),
  type: zodEnumFromConst(TransactionType),
  originalAmount: z.string().min(1),
  inputCurrency: z.string().min(3).max(3),
  title: z.string().nullable().optional(),
  occurredAt: z.string().datetime(),
  debtRole: zodEnumFromConst(TransactionDebtRole).nullable().optional(),
  counterparty: z.string().nullable().optional(),
  categories: z.array(z.string()).optional(),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await request.json());
    const result = await applyImport({
      userId: user.id,
      displayCurrency: user.defaultCurrency,
      rows: body.rows,
    });
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
