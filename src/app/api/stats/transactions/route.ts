import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import { getListPageStats } from "@/server/services/stats-service";
import {
  DateRangeType,
  TransactionKind,
  TransactionType,
} from "@/types/enums";

const querySchema = z.object({
  dateRangeType: zodEnumFromConst(DateRangeType).optional(),
  rollingUnit: z.enum(["days", "months", "years"]).optional(),
  rollingN: z.coerce.number().int().positive().max(3650).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: zodEnumFromConst(TransactionType).optional(),
  kinds: z.array(zodEnumFromConst(TransactionKind)).optional(),
  categoryIds: z.array(z.string().min(1)).optional(),
  counterpartyIds: z.array(z.string().min(1)).optional(),
  hideUncategorized: z.boolean().optional(),
  travelId: z.string().min(1).optional(),
}).refine(
  (value) =>
    Boolean(value.dateRangeType) ||
    Boolean(value.rollingUnit && value.rollingN) ||
    Boolean(value.startDate && value.endDate),
  { message: "dateRangeType, rolling range, or absolute range is required" },
);

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
      dateRangeType: searchParams.get("dateRangeType") ?? undefined,
      rollingUnit: searchParams.get("rollingUnit") ?? undefined,
      rollingN: searchParams.get("rollingN") ?? undefined,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      kinds: parseCsvParam(searchParams.get("kinds")),
      categoryIds: parseCsvParam(searchParams.get("categoryIds")),
      counterpartyIds: parseCsvParam(searchParams.get("counterpartyIds")),
      hideUncategorized:
        searchParams.get("hideUncategorized") === "true" ? true : undefined,
      travelId: searchParams.get("travelId") ?? undefined,
    });
    const stats = await getListPageStats({
      userId: user.id,
      timezone: user.timezone,
      displayCurrency: user.defaultCurrency,
      ...query,
    });
    return jsonOk(stats);
  } catch (error) {
    return handleRouteError(error);
  }
}
