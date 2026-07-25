import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import { getActivityHeatmap } from "@/server/services/stats-service";
import { TransactionDebtRole, TransactionType } from "@/types/enums";

const querySchema = z.object({
  type: zodEnumFromConst(TransactionType).optional(),
  debtRoles: z.array(zodEnumFromConst(TransactionDebtRole)).optional(),
  categoryIds: z.array(z.string().min(1)).optional(),
  counterpartyIds: z.array(z.string().min(1)).optional(),
  hideUncategorized: z.boolean().optional(),
});

function parseCsvParam(value: string | null): string[] | undefined {
  if (!value) {
    return undefined;
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      type: searchParams.get("type") ?? undefined,
      debtRoles: parseCsvParam(searchParams.get("debtRoles")),
      categoryIds: parseCsvParam(searchParams.get("categoryIds")),
      counterpartyIds: parseCsvParam(searchParams.get("counterpartyIds")),
      hideUncategorized:
        searchParams.get("hideUncategorized") === "true" ? true : undefined,
    });
    const heatmap = await getActivityHeatmap({
      userId: user.id,
      timezone: user.timezone,
      displayCurrency: user.defaultCurrency,
      ...query,
    });
    return jsonOk(heatmap);
  } catch (error) {
    return handleRouteError(error);
  }
}
