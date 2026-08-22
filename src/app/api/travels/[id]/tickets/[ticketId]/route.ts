import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { updateTicketBodySchema } from "@/lib/ticket-body-schema";
import {
  deleteTravelTicket,
  updateTravelTicket,
} from "@/server/services/travel-service";

type RouteContext = {
  params: Promise<{ id: string; ticketId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id, ticketId } = await context.params;
    const body = updateTicketBodySchema.parse(await request.json());
    const ticket = await updateTravelTicket({
      userId: user.id,
      travelId: id,
      ticketId,
      title: body.title,
      origin: body.origin,
      destination: body.destination,
      departsAt: optionalIsoToDate(body.departsAt),
      arrivesAt: optionalIsoToDate(body.arrivesAt),
      ticketNumber: body.ticketNumber,
      flightNumber: body.flightNumber,
      bookingCode: body.bookingCode,
      seat: body.seat,
    });
    return jsonOk({ ticket });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id, ticketId } = await context.params;
    await deleteTravelTicket({
      userId: user.id,
      travelId: id,
      ticketId,
    });
    return jsonOk({ ok: true as const });
  } catch (error) {
    return handleRouteError(error);
  }
}

function optionalIsoToDate(
  value: string | null | undefined,
): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value ? new Date(value) : null;
}
