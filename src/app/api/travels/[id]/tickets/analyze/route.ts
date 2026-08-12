import { jsonOk } from "@/lib/api-response";
import { AppServiceError } from "@/lib/errors";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import {
  MAX_TICKET_UPLOAD_BYTES,
  isSupportedImageType,
  isSupportedTicketType,
} from "@/server/services/storage-service";
import { analyzeTravelTicketFile } from "@/server/services/ticket-analysis-service";
import { ApiErrorCode } from "@/types/api";

export const maxDuration = 180;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const formData = await request.formData();
    const file = readAnalyzeFile(formData);
    const result = await analyzeTravelTicketFile({
      userId: user.id,
      travelId: id,
      fileName: file.name,
      contentType: file.type,
      body: Buffer.from(await file.arrayBuffer()),
    });
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

function readAnalyzeFile(formData: FormData): File {
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
  if (
    file.type !== "application/pdf" &&
    !isSupportedImageType(file.type)
  ) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "AI analysis supports PDF and images only",
    );
  }
  if (file.size > MAX_TICKET_UPLOAD_BYTES) {
    throw new AppServiceError(ApiErrorCode.Validation, "File is too large");
  }
  return file;
}
