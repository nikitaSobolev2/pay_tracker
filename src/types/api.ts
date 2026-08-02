export const ApiErrorCode = {
  Unauthorized: "UNAUTHORIZED",
  Validation: "VALIDATION",
  Forbidden: "FORBIDDEN",
  NotFound: "NOT_FOUND",
  Conflict: "CONFLICT",
  FxUnavailable: "FX_UNAVAILABLE",
  RateLimited: "RATE_LIMITED",
  Internal: "INTERNAL",
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};
