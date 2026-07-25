import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { getPublicHeatmapShareContext } from "@/server/services/shared-chart-service";
import { getListPageStats } from "@/server/services/stats-service";
import { TransactionDebtRole, TransactionType } from "@/types/enums";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      date: searchParams.get("date") ?? undefined,
    });
    const share = await getPublicHeatmapShareContext(id);
    const filters = share.payload.filters;
    const debtRoles = (filters?.debtRoles ?? []).filter(
      (role): role is (typeof TransactionDebtRole)[keyof typeof TransactionDebtRole] =>
        role === TransactionDebtRole.Lend || role === TransactionDebtRole.Borrow,
    );
    const type =
      filters?.type === TransactionType.Spending ||
      filters?.type === TransactionType.Earning
        ? filters.type
        : undefined;

    const stats = await getListPageStats({
      userId: share.userId,
      timezone: share.timezone,
      displayCurrency: share.displayCurrency,
      startDate: query.date,
      endDate: query.date,
      type,
      debtRoles: debtRoles.length ? debtRoles : undefined,
      categoryIds: filters?.categoryIds,
      counterpartyIds: filters?.counterpartyIds,
      hideUncategorized: filters?.hideUncategorized,
    });
    return jsonOk(stats);
  } catch (error) {
    return handleRouteError(error);
  }
}
