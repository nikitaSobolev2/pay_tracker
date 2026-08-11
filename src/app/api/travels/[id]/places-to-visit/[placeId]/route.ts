import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import {
  deletePlaceToVisit,
  updatePlaceToVisit,
} from "@/server/services/travel-service";

const optionalUrl = z
  .union([z.string().url().max(2000), z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (value == null || value === "") {
      return null;
    }
    return value;
  });

const updateBodySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    link: optionalUrl,
    address: z.string().max(500).nullish(),
    isChecked: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.link !== undefined ||
      value.address !== undefined ||
      value.isChecked !== undefined,
    { message: "At least one field is required" },
  );

type RouteContext = {
  params: Promise<{ id: string; placeId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id, placeId } = await context.params;
    const body = updateBodySchema.parse(
      await request.json().catch(() => ({})),
    );
    const place = await updatePlaceToVisit({
      userId: user.id,
      travelId: id,
      placeId,
      title: body.title,
      link: body.link,
      address: body.address,
      isChecked: body.isChecked,
    });
    return jsonOk({ place });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id, placeId } = await context.params;
    await deletePlaceToVisit({
      userId: user.id,
      travelId: id,
      placeId,
    });
    return jsonOk({ ok: true as const });
  } catch (error) {
    return handleRouteError(error);
  }
}
