import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { createTicketBodySchema } from "@/lib/ticket-body-schema";
import { createTravelTicket } from "@/server/services/travel-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = createTicketBodySchema.parse(await request.json());
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
      seat: body.seat,
    });
    return jsonOk({ ticket }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
