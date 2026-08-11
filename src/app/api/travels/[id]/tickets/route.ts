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
    });
    return jsonOk({ ticket }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
