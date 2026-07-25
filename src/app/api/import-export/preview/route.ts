import { jsonOk, validationError } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { previewImport } from "@/server/services/csv-import-export-service";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");
    const csvTextField = formData.get("csv");

    let csvText = "";
    if (typeof csvTextField === "string" && csvTextField.trim()) {
      csvText = csvTextField;
    } else if (file instanceof File) {
      csvText = await file.text();
    }

    if (!csvText.trim()) {
      return validationError("CSV content is required");
    }

    const preview = await previewImport(user.id, csvText);
    return jsonOk(preview);
  } catch (error) {
    return handleRouteError(error);
  }
}
