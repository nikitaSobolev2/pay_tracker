export type QrApprovalStatus =
  | "pending"
  | "approved"
  | "declined"
  | "consumed"
  | "expired";

/** URL the approver opens (native scan or in-app scanner) to approve a request. */
export function buildApprovalUrl(input: {
  readonly baseUrl: string;
  readonly locale: string;
  readonly token: string;
}): string {
  const base = input.baseUrl.replace(/\/$/, "");
  return `${base}/${input.locale}/approve/${encodeURIComponent(input.token)}`;
}

/** Extract an approval token from a scanned QR payload (full URL or raw token). */
export function parseApprovalToken(scannedText: string): string | null {
  const text = scannedText.trim();
  if (!text) {
    return null;
  }
  try {
    const url = new URL(text);
    const match = url.pathname.match(/\/approve\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]!) : null;
  } catch {
    return /^[A-Za-z0-9_-]+$/.test(text) ? text : null;
  }
}
