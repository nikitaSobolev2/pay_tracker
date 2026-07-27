export type CreateLoginTransferInput = {
  readonly userId: string;
  readonly locale: string;
  readonly baseUrl: string;
};

export type CreateLoginTransferResult = {
  readonly code: string;
  readonly token: string;
  readonly authUrl: string;
  readonly expiresAt: string;
};

export type RedeemLoginTransferInput = {
  readonly code?: string;
  readonly token?: string;
};

export type RedeemLoginTransferResult = {
  readonly userId: string;
};

/** Claim an existing code/QR, which then requires the owner's approval. */
export type BeginTransferApprovalInput = {
  readonly code?: string;
  readonly token?: string;
  readonly locale: string;
  readonly baseUrl?: string;
  readonly requesterUserAgent?: string | null;
  readonly requesterIp?: string | null;
};
