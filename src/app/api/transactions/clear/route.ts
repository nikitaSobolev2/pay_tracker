import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { clearTransactions } from "@/server/services/transaction-service";

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const bodySchema = z
  .object({
    startDate: dateOnlySchema.optional(),
    endDate: dateOnlySchema.optional(),
  })
  .superRefine((value, context) => {
    const hasStart = value.startDate !== undefined;
    const hasEnd = value.endDate !== undefined;
    if (hasStart !== hasEnd) {
      context.addIssue({
        code: "custom",
        message: "Both startDate and endDate are required for a date range",
        path: ["startDate"],
      });
    }
  });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await request.json());
    const result = await clearTransactions({
      userId: user.id,
      timezone: user.timezone,
      startDate: body.startDate,
      endDate: body.endDate,
    });
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
