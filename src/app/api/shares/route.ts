import { z } from "zod";

import { sharedChartPayloadSchema } from "@/features/share/shared-chart-payload";
import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import {
  createSharedChart,
  listSharedCharts,
} from "@/server/services/shared-chart-service";

const createSchema = z.object({
  title: z.string().max(120).nullable().optional(),
  payload: sharedChartPayloadSchema,
});

export async function GET() {
  try {
    const user = await requireUser();
    const shares = await listSharedCharts(user.id);
    return jsonOk(shares);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createSchema.parse(await request.json());
    const share = await createSharedChart({
      userId: user.id,
      title: body.title,
      payload: body.payload,
    });
    return jsonOk(share);
  } catch (error) {
    return handleRouteError(error);
  }
}
