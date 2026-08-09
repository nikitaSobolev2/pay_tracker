import { jsonOk } from "@/lib/api-response";
import { AppServiceError } from "@/lib/errors";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import {
  MAX_UPLOAD_BYTES,
  isSupportedImageType,
  uploadTravelCover,
} from "@/server/services/storage-service";
import { ApiErrorCode } from "@/types/api";

export async function POST(request: Request) {
  try {
    await requireUser();
    const formData = await request.formData();
    const file = readFile(formData);
    const url = await uploadTravelCover({
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
