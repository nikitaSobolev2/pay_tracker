import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { exportCsv } from "@/server/services/csv-import-export-service";

export async function GET() {
  try {
    const user = await requireUser();
    const result = await exportCsv(user.id);
    return new Response(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
