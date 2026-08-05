import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { fetchLinkPreviewImage } from "@/server/services/link-preview";

const bodySchema = z.object({
  url: z.string().url().max(2000),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const imageUrl = await fetchLinkPreviewImage(body.url);
    return jsonOk({ imageUrl });
  } catch (error) {
    return handleRouteError(error);
  }
}
