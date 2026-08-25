import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

import { AppServiceError } from "@/lib/errors";
import {
  DEFAULT_STORAGE_DIR,
  EVENT_IMAGE_PREFIX,
  EXTENSION_BY_CONTENT_TYPE,
  TICKET_EXTENSION_BY_CONTENT_TYPE,
  TRAVEL_IMAGE_PREFIX,
  contentTypeForFileName,
  isPublicObjectKey,
  isSafeObjectKey,
  isTravelTicketKey,
} from "@/lib/storage-keys";
import { ApiErrorCode } from "@/types/api";

export type UploadInput = {
  readonly body: Buffer;
  readonly contentType: string;
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_TICKET_UPLOAD_BYTES = 10 * 1024 * 1024;

export {
  EXTENSION_BY_CONTENT_TYPE,
  TICKET_EXTENSION_BY_CONTENT_TYPE,
} from "@/lib/storage-keys";

export function isSupportedImageType(contentType: string): boolean {
  return contentType in EXTENSION_BY_CONTENT_TYPE;
}

export function isSupportedTicketType(contentType: string): boolean {
  return contentType in TICKET_EXTENSION_BY_CONTENT_TYPE;
}

/** True when the URL points at an object we store under the events/ prefix. */
export function isOwnedEventImageUrl(url: string): boolean {
  try {
    const base = `${readPublicBaseUrl()}/${EVENT_IMAGE_PREFIX}/`;
    return url.startsWith(base);
  } catch {
    return false;
  }
}

/** Stores the cover and returns the public URL served from /files. */
export async function uploadEventCover(input: UploadInput): Promise<string> {
  return uploadEventImage(input, "covers");
}

/** Stores a chat/thread attachment under the public events prefix. */
export async function uploadEventAttachment(
  input: UploadInput,
): Promise<string> {
  return uploadEventImage(input, "attachments");
}

/** True when the URL points at an object we store under the travels/ prefix. */
export function isOwnedTravelImageUrl(url: string): boolean {
  return isOwnedTravelObjectUrl(url);
}

/** True when the URL points at any object under the travels/ public prefix. */
export function isOwnedTravelObjectUrl(url: string): boolean {
  try {
    const base = `${readPublicBaseUrl()}/${TRAVEL_IMAGE_PREFIX}/`;
    return url.startsWith(base);
  } catch {
    return false;
  }
}

/** Stores a travel cover and returns the public URL. */
export async function uploadTravelCover(input: UploadInput): Promise<string> {
  const extension = EXTENSION_BY_CONTENT_TYPE[input.contentType];
  if (!extension) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Unsupported image format",
    );
  }
  const key = `${TRAVEL_IMAGE_PREFIX}/covers/${randomUUID()}.${extension}`;
  await writeObject(key, input.body);
  return publicUrlForKey(key);
}

export type TravelTicketUploadResult = {
  readonly url: string;
  readonly contentType: string;
};

const TRAVEL_TICKET_PROXY_PATH = "/api/files/travel-ticket";
const TICKET_FILE_NAME_PATTERN = /^[0-9a-f-]{36}\.[a-z0-9]{1,8}$/i;

/**
 * Rewrites a stored ticket URL to the same-origin proxy route so the
 * service worker can cache ticket files for offline viewing.
 */
export function travelTicketProxyUrl(fileUrl: string): string {
  if (!isOwnedTravelTicketUrl(fileUrl)) {
    return fileUrl;
  }
  const fileName = fileUrl.split("/").pop() ?? "";
  if (!TICKET_FILE_NAME_PATTERN.test(fileName)) {
    return fileUrl;
  }
  return `${TRAVEL_TICKET_PROXY_PATH}/${fileName}`;
}

function isOwnedTravelTicketUrl(url: string): boolean {
  try {
    const base = `${readPublicBaseUrl()}/${TRAVEL_IMAGE_PREFIX}/tickets/`;
    return url.startsWith(base);
  } catch {
    return false;
  }
}

export type StoredFile = {
  readonly body: Buffer;
  readonly contentType: string;
};

/** Reads a public cover or attachment so `/files/...` can stream it. */
export async function downloadPublicObject(key: string): Promise<StoredFile> {
  if (!isPublicObjectKey(key)) {
    throw new AppServiceError(ApiErrorCode.NotFound, "File not found");
  }
  return readStoredFile(key);
}

/** Reads a stored ticket file so the proxy route can serve it same-origin. */
export async function downloadTravelTicket(
  fileName: string,
): Promise<StoredFile> {
  if (!TICKET_FILE_NAME_PATTERN.test(fileName)) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Ticket file not found");
  }
  const key = `${TRAVEL_IMAGE_PREFIX}/tickets/${fileName}`;
  if (!isTravelTicketKey(key)) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Ticket file not found");
  }
  try {
    return await readStoredFile(key);
  } catch (error) {
    if (isAppNotFound(error)) {
      throw new AppServiceError(ApiErrorCode.NotFound, "Ticket file not found");
    }
    throw error;
  }
}

/** Removes a ticket object when no travel ticket row still points at it. */
export async function deleteTravelTicketObject(fileUrl: string): Promise<void> {
  if (!isOwnedTravelTicketUrl(fileUrl)) {
    return;
  }
  const fileName = fileUrl.split("/").pop() ?? "";
  if (!TICKET_FILE_NAME_PATTERN.test(fileName)) {
    return;
  }
  const key = `${TRAVEL_IMAGE_PREFIX}/tickets/${fileName}`;
  await deleteObject(key);
}

/** Stores a travel ticket file and returns the public URL. */
export async function uploadTravelTicket(
  input: UploadInput,
): Promise<TravelTicketUploadResult> {
  const extension = TICKET_EXTENSION_BY_CONTENT_TYPE[input.contentType];
  if (!extension) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Unsupported ticket file format",
    );
  }
  const key = `${TRAVEL_IMAGE_PREFIX}/tickets/${randomUUID()}.${extension}`;
  await writeObject(key, input.body);
  return {
    url: publicUrlForKey(key),
    contentType: input.contentType,
  };
}

async function uploadEventImage(
  input: UploadInput,
  folder: "covers" | "attachments",
): Promise<string> {
  const extension = EXTENSION_BY_CONTENT_TYPE[input.contentType];
  if (!extension) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Unsupported image format",
    );
  }
  const key = `${EVENT_IMAGE_PREFIX}/${folder}/${randomUUID()}.${extension}`;
  await writeObject(key, input.body);
  return publicUrlForKey(key);
}

async function writeObject(key: string, body: Buffer): Promise<void> {
  const fullPath = resolveObjectPath(key);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, body);
}

async function readStoredFile(key: string): Promise<StoredFile> {
  const fullPath = resolveObjectPath(key);
  try {
    const body = await readFile(fullPath);
    return {
      body,
      contentType: contentTypeForFileName(key.split("/").pop() ?? ""),
    };
  } catch (error) {
    if (isNodeNotFound(error)) {
      throw new AppServiceError(ApiErrorCode.NotFound, "File not found");
    }
    throw error;
  }
}

async function deleteObject(key: string): Promise<void> {
  const fullPath = resolveObjectPath(key);
  try {
    await unlink(fullPath);
  } catch (error) {
    if (isNodeNotFound(error)) {
      return;
    }
    throw error;
  }
}

function resolveObjectPath(key: string): string {
  if (!isSafeObjectKey(key)) {
    throw new AppServiceError(ApiErrorCode.NotFound, "File not found");
  }
  const root = resolve(readStorageDir());
  const fullPath = resolve(root, key);
  if (fullPath !== root && !fullPath.startsWith(`${root}${sep}`)) {
    throw new AppServiceError(ApiErrorCode.NotFound, "File not found");
  }
  return fullPath;
}

function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") {
    end -= 1;
  }
  return value.slice(0, end);
}

function readStorageDir(): string {
  const configured = process.env.STORAGE_DIR;
  if (configured) {
    return stripTrailingSlashes(configured);
  }
  return DEFAULT_STORAGE_DIR;
}

function publicUrlForKey(key: string): string {
  return `${readPublicBaseUrl()}/${key}`;
}

function readPublicBaseUrl(): string {
  const explicit = process.env.S3_PUBLIC_URL;
  if (explicit && !isLegacyMinioPublicUrl(explicit)) {
    return stripTrailingSlashes(explicit);
  }
  const appUrl = process.env.BETTER_AUTH_URL;
  if (appUrl) {
    return `${stripTrailingSlashes(appUrl)}/files`;
  }
  throw new AppServiceError(
    ApiErrorCode.Internal,
    "File storage is not configured: S3_PUBLIC_URL is missing",
  );
}

function isLegacyMinioPublicUrl(url: string): boolean {
  try {
    return new URL(url).port === "9000";
  } catch {
    return false;
  }
}

function isNodeNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function isAppNotFound(error: unknown): boolean {
  return error instanceof AppServiceError && error.code === ApiErrorCode.NotFound;
}
