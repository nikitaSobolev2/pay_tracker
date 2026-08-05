import { jsonOk } from "@/lib/api-response";
import { requireEventAccess } from "@/lib/event-access";
import { AppServiceError } from "@/lib/errors";
import { handleRouteError } from "@/lib/route-handler";
import {
  MAX_UPLOAD_BYTES,
  isSupportedImageType,
  uploadEventAttachment,
} from "@/server/services/storage-service";
import { ApiErrorCode } from "@/types/api";

/**
 * Any event participant may upload chat/thread images.
 * Covers still go through /api/uploads/event-cover (edit rights).
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const eventId = readEventId(formData);
    await requireEventAccess(eventId);
    const file = readFile(formData);

    const url = await uploadEventAttachment({
      body: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
    });
    return jsonOk({ url });
  } catch (error) {
    return handleRouteError(error);
  }
}

function readFile(formData: FormData): File {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new AppServiceError(ApiErrorCode.Validation, "Select an image first");
  }
  if (!isSupportedImageType(file.type)) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Only PNG, JPEG, WebP and GIF images are supported",
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AppServiceError(ApiErrorCode.Validation, "Image is too large");
  }
  return file;
}

function readEventId(formData: FormData): string {
  const eventId = formData.get("eventId");
  if (typeof eventId !== "string" || !eventId) {
    throw new AppServiceError(ApiErrorCode.Validation, "Event is required");
  }
  return eventId;
}
