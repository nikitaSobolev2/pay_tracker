import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { createTravel, listTravels } from "@/server/services/travel-service";

const createBodySchema = z.object({
  title: z.string().min(1).max(200),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  imageUrl: z.string().url().max(2000).nullish(),
  placeCountry: z.string().max(120).nullish(),
  placeCity: z.string().max(120).nullish(),
  placeLabel: z.string().max(240).nullish(),
  housingAddress: z.string().max(500).nullish(),
  housingLatitude: z.number().min(-90).max(90).nullish(),
  housingLongitude: z.number().min(-180).max(180).nullish(),
  maxSpendingGoal: z.string().max(40).nullish(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const travels = await listTravels(user.id);
    return jsonOk({ travels });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createBodySchema.parse(await request.json());
    const travelId = await createTravel({
      userId: user.id,
      title: body.title,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      imageUrl: body.imageUrl,
      placeCountry: body.placeCountry,
      placeCity: body.placeCity,
      placeLabel: body.placeLabel,
      housingAddress: body.housingAddress,
      housingLatitude: body.housingLatitude,
      housingLongitude: body.housingLongitude,
      currency: user.defaultCurrency,
      maxSpendingGoal: body.maxSpendingGoal,
    });
    return jsonOk({ travelId }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
