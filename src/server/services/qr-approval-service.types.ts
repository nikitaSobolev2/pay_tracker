import type { QrApprovalStatus } from "@/lib/qr-approval";

export type CreateApprovalInput = {
  readonly locale: string;
  /** Optional; when present the result includes a scannable approval URL. */
  readonly baseUrl?: string;
  readonly requesterUserAgent?: string | null;
  readonly requesterIp?: string | null;
  /** Push flow: restrict approval to this user (the code/QR owner). */
  readonly boundUserId?: string | null;
};

export type CreateApprovalResult = {
  readonly token: string;
  readonly approvalUrl: string;
  readonly status: QrApprovalStatus;
  readonly expiresAt: string;
};

export type ApprovalStatusResult = {
  readonly status: QrApprovalStatus;
};

export type ApprovalInfo = {
  readonly status: QrApprovalStatus;
  readonly requesterUserAgent: string | null;
  readonly requesterIp: string | null;
  readonly createdAt: string;
  readonly expiresAt: string;
  /** True when this request is restricted to a specific approver (push flow). */
  readonly bound: boolean;
};

/** Identifies an approval either by scanned token (pull) or row id (push list). */
export type ApprovalRef = {
  readonly token?: string;
  readonly id?: string;
};

export type ResolveApprovalInput = ApprovalRef & {
  readonly approverUserId: string;
};

export type IncomingApproval = {
  readonly id: string;
  readonly requesterUserAgent: string | null;
  readonly requesterIp: string | null;
  readonly createdAt: string;
  readonly expiresAt: string;
};

export type RedeemApprovalResult = {
  readonly userId: string;
};
