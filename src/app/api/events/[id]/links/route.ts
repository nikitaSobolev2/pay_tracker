import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { assertCanEdit, requireEventAccess } from "@/lib/event-access";
import { handleRouteError } from "@/lib/route-handler";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import { createLink } from "@/server/services/event-service";
import { EventLinkType } from "@/types/enums";

const createBodySchema = z.object({
  type: zodEnumFromConst(EventLinkType).default(EventLinkType.Other),
  title: z.string().min(1).max(200),
  url: z.string().url().max(2000),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireEventAccess(id);
    assertCanEdit(access.viewer);
    const body = createBodySchema.parse(await request.json());
    const link = await createLink({
      eventId: id,
      type: body.type,
      title: body.title,
      url: body.url,
    });
    return jsonOk({ link }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
