import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { searchPlaces } from "@/server/services/geocode-service";
import { AppLocale } from "@/types/enums";

const querySchema = z.object({
  q: z.string().min(1).max(200),
  locale: z.string().max(10).default(AppLocale.En),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      q: searchParams.get("q") ?? "",
      locale: searchParams.get("locale") ?? undefined,
    });
    const places = await searchPlaces(query.q, query.locale);
    return jsonOk({ places });
  } catch (error) {
    return handleRouteError(error);
  }
}
