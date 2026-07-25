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
