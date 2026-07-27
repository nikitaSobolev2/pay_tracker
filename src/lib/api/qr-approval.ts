import type { QrApprovalStatus } from "@/lib/qr-approval";

export type QrApprovalRequestDto = {
  readonly token: string;
  readonly approvalUrl: string;
  readonly status: QrApprovalStatus;
  readonly expiresAt: string;
};

export type QrApprovalInfoDto = {
  readonly status: QrApprovalStatus;
  readonly requesterUserAgent: string | null;
  readonly requesterIp: string | null;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly bound: boolean;
};

export type IncomingApprovalDto = {
  readonly id: string;
  readonly requesterUserAgent: string | null;
  readonly requesterIp: string | null;
  readonly createdAt: string;
  readonly expiresAt: string;
};

async function parseError(response: Response): Promise<never> {
  const payload = (await response.json().catch(() => null)) as {
    message?: string;
    error?: { message?: string };
  } | null;
  throw new Error(
    payload?.message ?? payload?.error?.message ?? "Request failed",
  );
}

export async function createQrApproval(
  locale: string,
): Promise<QrApprovalRequestDto> {
  const response = await fetch("/api/auth/qr-approval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  if (!response.ok) {
    return parseError(response);
  }
  return (await response.json()) as QrApprovalRequestDto;
}

export async function getQrApprovalStatus(
  token: string,
): Promise<QrApprovalStatus> {
  const response = await fetch(
    `/api/auth/qr-approval/status?token=${encodeURIComponent(token)}`,
    { method: "GET" },
  );
  if (!response.ok) {
    return parseError(response);
  }
  const payload = (await response.json()) as { status: QrApprovalStatus };
  return payload.status;
}

export async function getQrApprovalInfo(
  token: string,
): Promise<QrApprovalInfoDto> {
  const response = await fetch(
    `/api/auth/qr-approval/info?token=${encodeURIComponent(token)}`,
    { method: "GET" },
  );
  if (!response.ok) {
    return parseError(response);
  }
  return (await response.json()) as QrApprovalInfoDto;
}

export async function approveQrApproval(
  ref: { token?: string; id?: string },
): Promise<void> {
  const response = await fetch("/api/auth/qr-approval/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ref),
  });
  if (!response.ok) {
    await parseError(response);
  }
}

export async function declineQrApproval(
  ref: { token?: string; id?: string },
): Promise<void> {
  const response = await fetch("/api/auth/qr-approval/decline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ref),
  });
  if (!response.ok) {
    await parseError(response);
  }
}

export async function redeemQrApproval(token: string): Promise<void> {
  const response = await fetch("/api/auth/qr-approval/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    credentials: "include",
  });
  if (!response.ok) {
    await parseError(response);
  }
}

export async function getIncomingApprovals(): Promise<IncomingApprovalDto[]> {
  const response = await fetch("/api/auth/qr-approval/incoming", {
    method: "GET",
  });
  if (!response.ok) {
    return parseError(response);
  }
  const payload = (await response.json()) as {
    approvals: IncomingApprovalDto[];
  };
  return payload.approvals;
}
