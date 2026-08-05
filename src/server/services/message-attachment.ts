import { AppServiceError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api";
import { isOwnedEventImageUrl } from "@/server/services/storage-service";

export type MessageAttachmentContent = {
  readonly body: string;
  readonly imageUrl: string | null;
};

const MAX_BODY_LENGTH = 2000;

/** Accepts text, an owned image URL, or both; rejects empty posts. */
export function normalizeMessageAttachment(input: {
  readonly body?: string | null;
  readonly imageUrl?: string | null;
}): MessageAttachmentContent {
  const body = (input.body ?? "").trim().slice(0, MAX_BODY_LENGTH);
  const imageUrl = normalizeAttachmentUrl(input.imageUrl);
  if (!body && !imageUrl) {
    throw new AppServiceError(ApiErrorCode.Validation, "Message is empty");
  }
  return { body, imageUrl };
}

function normalizeAttachmentUrl(
  imageUrl: string | null | undefined,
): string | null {
  const trimmed = imageUrl?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > 2000 || !isOwnedEventImageUrl(trimmed)) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Invalid image attachment",
    );
  }
  return trimmed;
}
