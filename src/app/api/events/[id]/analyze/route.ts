import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { requireEventOwnerAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { analyzeEvent } from "@/server/services/event-analysis-service";
import { AppLocale } from "@/types/enums";

/** Analyzer waits on an external model; give the route room to finish. */
export const maxDuration = 180;

type RouteContext = {
  params: Promise<{ id: string }>;
};

const bodySchema = z.object({
  contextMessage: z.string().max(2000).nullish(),
  responseLocale: z.enum([AppLocale.En, AppLocale.Ru]).nullish(),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireEventOwnerAccess(id);
    const body = bodySchema.parse(await request.json());
    const report = await analyzeEvent({
      eventId: id,
      contextMessage: body.contextMessage,
      responseLocale: body.responseLocale,
    });
    return jsonOk({ report });
  } catch (error) {
    return handleRouteError(error);
  }
}
