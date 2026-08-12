import { randomUUID } from "node:crypto";

import { Client as MinioClient } from "minio";

import { AppServiceError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api";

export type UploadInput = {
  readonly body: Buffer;
  readonly contentType: string;
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_TICKET_UPLOAD_BYTES = 10 * 1024 * 1024;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const TICKET_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  ...EXTENSION_BY_CONTENT_TYPE,
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

const EVENT_IMAGE_PREFIX = "events";
const TRAVEL_IMAGE_PREFIX = "travels";

let client: MinioClient | null = null;
let bucketReady: Promise<void> | null = null;

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

/** Stores the cover and returns the public URL served from the files subdomain. */
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
  await ensureBucket();
  await getClient().putObject(readBucket(), key, input.body, input.body.length, {
    "Content-Type": input.contentType,
  });
  return `${readPublicBaseUrl()}/${key}`;
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

export type TravelTicketFile = {
  readonly body: Buffer;
  readonly contentType: string;
};

/** Reads a stored ticket file so the proxy route can serve it same-origin. */
export async function downloadTravelTicket(
  fileName: string,
): Promise<TravelTicketFile> {
  if (!TICKET_FILE_NAME_PATTERN.test(fileName)) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Ticket file not found");
  }
  const key = `${TRAVEL_IMAGE_PREFIX}/tickets/${fileName}`;
  const bucket = readBucket();
  const minio = getClient();
  try {
    const stat = await minio.statObject(bucket, key);
    const stream = await minio.getObject(bucket, key);
    const body = await readStreamToBuffer(stream);
    const contentType =
      (stat.metaData?.["content-type"] as string | undefined) ??
      "application/octet-stream";
    return { body, contentType };
  } catch (error) {
    if (isMissingObjectError(error)) {
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
  try {
    await getClient().removeObject(readBucket(), key);
  } catch (error) {
    if (isMissingObjectError(error)) {
      return;
    }
    throw error;
  }
}

function isMissingObjectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    (error as { code?: string }).code === "NoSuchKey"
  );
}

async function readStreamToBuffer(
  stream: NodeJS.ReadableStream,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
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
  await ensureBucket();
  await getClient().putObject(readBucket(), key, input.body, input.body.length, {
    "Content-Type": input.contentType,
  });
  return {
    url: `${readPublicBaseUrl()}/${key}`,
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
  await ensureBucket();
  await getClient().putObject(readBucket(), key, input.body, input.body.length, {
    "Content-Type": input.contentType,
  });
  return `${readPublicBaseUrl()}/${key}`;
}

/** Creates the bucket with anonymous read once per process, so URLs work without signing. */
export async function ensureBucket(): Promise<void> {
  bucketReady ??= createBucketIfMissing();
  try {
    await bucketReady;
  } catch (error) {
    bucketReady = null;
    throw error;
  }
}

async function createBucketIfMissing(): Promise<void> {
  const bucket = readBucket();
  const minio = getClient();
  if (!(await minio.bucketExists(bucket))) {
    await minio.makeBucket(bucket);
  }
  await minio.setBucketPolicy(bucket, JSON.stringify(publicReadPolicy(bucket)));
}

function publicReadPolicy(bucket: string) {
  return {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [
          `arn:aws:s3:::${bucket}/${EVENT_IMAGE_PREFIX}/*`,
          `arn:aws:s3:::${bucket}/${TRAVEL_IMAGE_PREFIX}/*`,
        ],
      },
    ],
  };
}

function getClient(): MinioClient {
  client ??= createClient();
  return client;
}

function createClient(): MinioClient {
  const endpoint = new URL(requireEnv("S3_ENDPOINT"));
  return new MinioClient({
    endPoint: endpoint.hostname,
    port: Number(endpoint.port || (endpoint.protocol === "https:" ? 443 : 80)),
    useSSL: endpoint.protocol === "https:",
    accessKey: requireEnv("S3_ACCESS_KEY"),
    secretKey: requireEnv("S3_SECRET_KEY"),
  });
}

function readBucket(): string {
  return requireEnv("S3_BUCKET");
}

function readPublicBaseUrl(): string {
  return requireEnv("S3_PUBLIC_URL").replace(/\/+$/, "");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new AppServiceError(
      ApiErrorCode.Internal,
      `File storage is not configured: ${name} is missing`,
    );
  }
  return value;
}
