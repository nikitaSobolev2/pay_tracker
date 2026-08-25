export const EVENT_IMAGE_PREFIX = "events";
export const TRAVEL_IMAGE_PREFIX = "travels";
export const DEFAULT_STORAGE_DIR = ".data/files";
export const DEFAULT_STORAGE_BUCKET = "paytracker";

export const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const TICKET_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  ...EXTENSION_BY_CONTENT_TYPE,
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const OBJECT_FILE_NAME = /^[0-9a-f-]{36}\.[a-z0-9]{1,8}$/i;

export function contentTypeForFileName(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
}

export function isSafeObjectKey(key: string): boolean {
  if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    return false;
  }
  return /^[a-z0-9][a-z0-9./_-]*$/i.test(key);
}

export function stripBucketPrefix(
  key: string,
  bucket = DEFAULT_STORAGE_BUCKET,
): string {
  const prefix = `${bucket}/`;
  if (key.startsWith(prefix)) {
    return key.slice(prefix.length);
  }
  return key;
}

export function objectKeyFromSegments(segments: readonly string[]): string {
  return stripBucketPrefix(segments.filter(Boolean).join("/"));
}

export function isPublicObjectKey(key: string): boolean {
  return isEventImageKey(key) || isTravelCoverKey(key);
}

export function isEventImageKey(key: string): boolean {
  return matchesPrefixedFile(key, EVENT_IMAGE_PREFIX, ["covers", "attachments"]);
}

export function isTravelCoverKey(key: string): boolean {
  return matchesPrefixedFile(key, TRAVEL_IMAGE_PREFIX, ["covers"]);
}

export function isTravelTicketKey(key: string): boolean {
  return matchesPrefixedFile(key, TRAVEL_IMAGE_PREFIX, ["tickets"]);
}

function matchesPrefixedFile(
  key: string,
  prefix: string,
  folders: readonly string[],
): boolean {
  if (!isSafeObjectKey(key)) {
    return false;
  }
  const parts = key.split("/");
  if (parts.length !== 3) {
    return false;
  }
  const [first, folder, fileName] = parts;
  return (
    first === prefix &&
    folders.includes(folder) &&
    OBJECT_FILE_NAME.test(fileName)
  );
}
