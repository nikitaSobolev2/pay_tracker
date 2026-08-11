import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { createPlaceToVisit } from "@/server/services/travel-service";

const optionalUrl = z
  .union([z.string().url().max(2000), z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (value == null || value === "") {
      return null;
    }
    return value;
  });

const createBodySchema = z.object({
  title: z.string().min(1).max(200),
  link: optionalUrl,
  address: z.string().max(500).nullish(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = createBodySchema.parse(await request.json());
    const place = await createPlaceToVisit({
      userId: user.id,
      travelId: id,
      title: body.title,
      link: body.link,
      address: body.address,
    });
    return jsonOk({ place }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
