export const LOGIN_TRANSFER_TTL_MS = 5 * 60 * 1000;
export const LOGIN_TRANSFER_CODE_LENGTH = 6;

export function normalizeLoginCode(code: string): string {
  return code.replace(/\D/g, "").slice(0, LOGIN_TRANSFER_CODE_LENGTH);
}

export function isValidLoginCode(code: string): boolean {
  return new RegExp(`^\\d{${LOGIN_TRANSFER_CODE_LENGTH}}$`).test(code);
}

export function buildLoginTransferAuthUrl(input: {
  readonly baseUrl: string;
  readonly locale: string;
  readonly token: string;
}): string {
  const base = input.baseUrl.replace(/\/$/, "");
  return `${base}/${input.locale}/login/qr/${encodeURIComponent(input.token)}`;
}

export function transferExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + LOGIN_TRANSFER_TTL_MS);
}

export function isTransferExpired(
  expiresAt: Date,
  now = new Date(),
): boolean {
  return expiresAt.getTime() <= now.getTime();
}
