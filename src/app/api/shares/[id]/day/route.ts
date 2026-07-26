import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { getPublicShareDrilldownContext } from "@/server/services/shared-chart-service";
import { getListPageStats } from "@/server/services/stats-service";
import { TransactionKind, TransactionType } from "@/types/enums";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const querySchema = z
  .object({
    date: dateSchema.optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.date) {
      return;
    }
    if (!value.startDate || !value.endDate) {
      context.addIssue({
        code: "custom",
        message: "Provide date, or both startDate and endDate",
        path: ["date"],
      });
    }
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
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
    });
    const share = await getPublicShareDrilldownContext(id);
    const filters = share.payload.filters;
    const kinds = (filters?.kinds ?? []).filter(
      (kind): kind is TransactionKind =>
        Object.values(TransactionKind).includes(kind as TransactionKind),
    );
    const type =
      filters?.type === TransactionType.Spending ||
      filters?.type === TransactionType.Earning
        ? filters.type
        : undefined;

    const startDate = query.date ?? query.startDate!;
    const endDate = query.date ?? query.endDate!;

    const stats = await getListPageStats({
      userId: share.userId,
      timezone: share.timezone,
      displayCurrency: share.displayCurrency,
      startDate,
      endDate,
      type,
      kinds: kinds.length > 0 ? kinds : undefined,
      categoryIds: filters?.categoryIds,
      counterpartyIds: filters?.counterpartyIds,
      hideUncategorized: filters?.hideUncategorized,
    });
    return jsonOk(stats);
  } catch (error) {
    return handleRouteError(error);
  }
}
