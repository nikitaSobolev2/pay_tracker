import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { applyImport } from "@/server/services/csv-import-export-service";

const bodySchema = z.object({
  csvText: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await request.json());
    const result = await applyImport({
      userId: user.id,
      displayCurrency: user.defaultCurrency,
      csvText: body.csvText,
    });
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
