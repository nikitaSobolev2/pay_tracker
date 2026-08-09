import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { suggestTravels } from "@/server/services/travel-service";

const querySchema = z.object({
  q: z.string().max(200).optional().default(""),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({ q: searchParams.get("q") ?? "" });
    const travels = await suggestTravels({
      userId: user.id,
      query: query.q,
    });
    return jsonOk({ travels });
  } catch (error) {
    return handleRouteError(error);
  }
}
