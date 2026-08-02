import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { assertCanEdit, requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import { deleteLink, updateLink } from "@/server/services/event-service";
import { EventLinkType } from "@/types/enums";

const updateBodySchema = z.object({
  type: zodEnumFromConst(EventLinkType).optional(),
  title: z.string().min(1).max(200).optional(),
  url: z.string().url().max(2000).optional(),
});

type RouteContext = {
  params: Promise<{ id: string; linkId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id, linkId } = await context.params;
    const access = await requireEventAccess(id);
    assertCanEdit(access.viewer);
    const body = updateBodySchema.parse(await request.json());
    const link = await updateLink({
      eventId: id,
      linkId,
      type: body.type,
      title: body.title,
      url: body.url,
    });
    return jsonOk({ link });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id, linkId } = await context.params;
    const access = await requireEventAccess(id);
    assertCanEdit(access.viewer);
    await deleteLink({ eventId: id, linkId });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
