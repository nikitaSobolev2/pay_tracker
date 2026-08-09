import { randomUUID } from "node:crypto";

import { Client as MinioClient } from "minio";

import { AppServiceError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api";

export type UploadInput = {
  readonly body: Buffer;
  readonly contentType: string;
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const EVENT_IMAGE_PREFIX = "events";
const TRAVEL_IMAGE_PREFIX = "travels";

let client: MinioClient | null = null;
let bucketReady: Promise<void> | null = null;

export function isSupportedImageType(contentType: string): boolean {
  return contentType in EXTENSION_BY_CONTENT_TYPE;
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
