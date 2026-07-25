import { createHash, randomBytes, randomInt } from "node:crypto";

import { LOGIN_TRANSFER_CODE_LENGTH } from "@/lib/login-transfer";

export {
  LOGIN_TRANSFER_CODE_LENGTH,
  LOGIN_TRANSFER_TTL_MS,
  buildLoginTransferAuthUrl,
  isTransferExpired,
  isValidLoginCode,
  normalizeLoginCode,
  transferExpiresAt,
} from "@/lib/login-transfer";

export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateNumericCode(
  length = LOGIN_TRANSFER_CODE_LENGTH,
): string {
  const max = 10 ** length;
  return String(randomInt(0, max)).padStart(length, "0");
}

export function generateTransferToken(): string {
  return randomBytes(32).toString("base64url");
}
