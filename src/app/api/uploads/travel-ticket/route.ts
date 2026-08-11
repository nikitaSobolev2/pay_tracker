import { jsonOk } from "@/lib/api-response";
import { AppServiceError } from "@/lib/errors";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import {
  MAX_TICKET_UPLOAD_BYTES,
  isSupportedTicketType,
  uploadTravelTicket,
} from "@/server/services/storage-service";
import { ApiErrorCode } from "@/types/api";

export async function POST(request: Request) {
  try {
    await requireUser();
    const formData = await request.formData();
    const file = readTicketFile(formData);
    const uploaded = await uploadTravelTicket({
      body: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
    });
    return jsonOk({
      url: uploaded.url,
      fileName: file.name,
      contentType: uploaded.contentType,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function readTicketFile(formData: FormData): File {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new AppServiceError(ApiErrorCode.Validation, "Select a file first");
  }
  if (!isSupportedTicketType(file.type)) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Unsupported ticket file format",
    );
  }
  if (file.size > MAX_TICKET_UPLOAD_BYTES) {
    throw new AppServiceError(ApiErrorCode.Validation, "File is too large");
  }
  return file;
}
