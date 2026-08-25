import { handleRouteError } from "@/lib/route-handler";
import { objectKeyFromSegments } from "@/lib/storage-keys";
import { downloadPublicObject } from "@/server/services/storage-service";

type RouteContext = {
  params: Promise<{ key: string[] }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { key: segments } = await context.params;
    const file = await downloadPublicObject(objectKeyFromSegments(segments));
    return new Response(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.body.length),
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
