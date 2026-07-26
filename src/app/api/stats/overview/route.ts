import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import { getOverviewStats } from "@/server/services/stats-service";
import { DateRangeType } from "@/types/enums";

const querySchema = z
  .object({
    dateRangeType: zodEnumFromConst(DateRangeType).default(DateRangeType.Month),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .superRefine((value, context) => {
    if ((value.startDate == null) !== (value.endDate == null)) {
      context.addIssue({
        code: "custom",
        message: "startDate and endDate must be provided together",
        path: ["startDate"],
      });
    }
  });

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      dateRangeType: searchParams.get("dateRangeType") ?? undefined,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
    });
    const stats = await getOverviewStats({
      userId: user.id,
      timezone: user.timezone,
      displayCurrency: user.defaultCurrency,
      dateRangeType: query.dateRangeType,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return jsonOk(stats);
  } catch (error) {
    return handleRouteError(error);
  }
}
