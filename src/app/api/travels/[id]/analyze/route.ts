import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { analyzeTravel } from "@/server/services/travel-analysis-service";

export const maxDuration = 180;

const bodySchema = z.object({
  responseLocale: z.string().min(2).max(10),
  contextMessage: z.string().max(4000).nullish(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = bodySchema.parse(await request.json());
    const report = await analyzeTravel({
      userId: user.id,
      travelId: id,
      responseLocale: body.responseLocale,
      contextMessage: body.contextMessage,
    });
    return jsonOk({ report });
  } catch (error) {
    return handleRouteError(error);
  }
}
