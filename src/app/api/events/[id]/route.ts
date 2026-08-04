import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import {
  assertIsOwner,
  requireEventAccess,
  requireEventOwnerAccess,
} from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import {
  deleteEvent,
  getEventDetail,
  updateEvent,
} from "@/server/services/event-service";
import { EventGuestPermission, EventPublicity } from "@/types/enums";

const positiveMoney = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, "Enter a positive number");

const updateBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).nullish(),
  occursAt: z.iso.datetime().optional(),
  endsAt: z.iso.datetime().nullish(),
  imageUrl: z.string().max(2000).nullish(),
  address: z.string().max(500).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  publicity: zodEnumFromConst(EventPublicity).optional(),
  guestPermission: zodEnumFromConst(EventGuestPermission).optional(),
  ownerDisplayName: z.string().max(60).nullish(),
  manualPerPersonAmount: positiveMoney.nullish(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    const detail = await getEventDetail(access);
    return jsonOk(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    const body = updateBodySchema.parse(await request.json());
    assertCanApplyPatch(access.viewer.canEdit, body, () =>
      assertIsOwner(access.viewer),
    );
    await updateEvent({
      eventId: id,
      title: body.title,
      description: body.description,
      occursAt: body.occursAt ? new Date(body.occursAt) : undefined,
      endsAt: toOptionalDate(body.endsAt),
      imageUrl: body.imageUrl,
      address: body.address,
      latitude: body.latitude,
      longitude: body.longitude,
      publicity: body.publicity,
      guestPermission: body.guestPermission,
      ownerDisplayName: body.ownerDisplayName,
      manualPerPersonAmount: body.manualPerPersonAmount,
    });
    const detail = await getEventDetail(await requireEventAccess(id));
    return jsonOk(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireEventOwnerAccess(id);
    await deleteEvent(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Absent leaves the value untouched, explicit null clears it. */
function toOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === null ? null : new Date(value);
}

/** Sharing settings and the owner name are owner-only; the rest follows canEdit. */
function assertCanApplyPatch(
  canEdit: boolean,
  body: z.infer<typeof updateBodySchema>,
  requireOwner: () => void,
): void {
  const touchesOwnerOnlyFields =
    body.publicity !== undefined ||
    body.guestPermission !== undefined ||
    body.ownerDisplayName !== undefined ||
    body.manualPerPersonAmount !== undefined;
  if (touchesOwnerOnlyFields) {
    requireOwner();
    return;
  }
  if (!canEdit) {
    requireOwner();
  }
}
