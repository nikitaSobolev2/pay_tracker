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

const EVENT_COVER_PREFIX = "events";

let client: MinioClient | null = null;
let bucketReady: Promise<void> | null = null;

export function isSupportedImageType(contentType: string): boolean {
  return contentType in EXTENSION_BY_CONTENT_TYPE;
}

/** Stores the cover and returns the public URL served from the files subdomain. */
export async function uploadEventCover(input: UploadInput): Promise<string> {
  const extension = EXTENSION_BY_CONTENT_TYPE[input.contentType];
  if (!extension) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Unsupported image format",
    );
  }

  const key = `${EVENT_COVER_PREFIX}/${randomUUID()}.${extension}`;
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
        Resource: [`arn:aws:s3:::${bucket}/${EVENT_COVER_PREFIX}/*`],
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
