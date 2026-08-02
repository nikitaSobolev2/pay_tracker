import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { reverseGeocode } from "@/server/services/geocode-service";
import { AppLocale } from "@/types/enums";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  locale: z.string().max(10).default(AppLocale.En),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      lat: searchParams.get("lat"),
      lon: searchParams.get("lon"),
      locale: searchParams.get("locale") ?? undefined,
    });
    const place = await reverseGeocode(query.lat, query.lon, query.locale);
    return jsonOk({ place });
  } catch (error) {
    return handleRouteError(error);
  }
}
