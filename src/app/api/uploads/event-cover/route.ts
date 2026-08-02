import { jsonOk } from "@/lib/api-response";
import { assertCanEdit, requireEventAccess } from "@/lib/event-access";
import { AppServiceError } from "@/lib/errors";
import { handleRouteError } from "@/lib/route-handler";
import { getSessionUser } from "@/lib/session";
import {
  MAX_UPLOAD_BYTES,
  isSupportedImageType,
  uploadEventCover,
} from "@/server/services/storage-service";
import { ApiErrorCode } from "@/types/api";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    await assertCanUpload(readEventId(formData));
    const file = readFile(formData);

    const url = await uploadEventCover({
      body: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
    });
    return jsonOk({ url });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Anyone allowed to edit the event may replace its cover; creators are signed in. */
async function assertCanUpload(eventId: string | null): Promise<void> {
  const sessionUser = await getSessionUser();
  if (sessionUser) {
    return;
  }
  if (!eventId) {
    throw new AppServiceError(ApiErrorCode.Unauthorized, "Unauthorized");
  }
  const access = await requireEventAccess(eventId);
  assertCanEdit(access.viewer);
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

function readEventId(formData: FormData): string | null {
  const eventId = formData.get("eventId");
  return typeof eventId === "string" && eventId ? eventId : null;
}
