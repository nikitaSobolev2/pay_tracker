import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { createTravelTicket } from "@/server/services/travel-service";

const createBodySchema = z.object({
  title: z.string().min(1).max(200),
  fileUrl: z.string().url().max(2000),
  fileName: z.string().min(1).max(500),
  contentType: z.string().min(1).max(200),
  origin: z.string().max(200).nullish(),
  destination: z.string().max(200).nullish(),
  departsAt: z.string().datetime({ offset: true }).nullish(),
  arrivesAt: z.string().datetime({ offset: true }).nullish(),
  ticketNumber: z.string().max(100).nullish(),
  flightNumber: z.string().max(50).nullish(),
  bookingCode: z.string().max(50).nullish(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = createBodySchema.parse(await request.json());
    const ticket = await createTravelTicket({
      userId: user.id,
      travelId: id,
      title: body.title,
      fileUrl: body.fileUrl,
      fileName: body.fileName,
      contentType: body.contentType,
      origin: body.origin,
      destination: body.destination,
      departsAt: body.departsAt ? new Date(body.departsAt) : null,
      arrivesAt: body.arrivesAt ? new Date(body.arrivesAt) : null,
      ticketNumber: body.ticketNumber,
      flightNumber: body.flightNumber,
      bookingCode: body.bookingCode,
    });
    return jsonOk({ ticket }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
