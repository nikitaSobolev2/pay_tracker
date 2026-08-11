import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { downloadTravelTicket } from "@/server/services/storage-service";

type RouteContext = {
  params: Promise<{ fileName: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireUser();
    const { fileName } = await context.params;
    const file = await downloadTravelTicket(fileName);
    return new Response(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.body.length),
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
