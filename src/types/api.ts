export const ApiErrorCode = {
  Unauthorized: "UNAUTHORIZED",
  Validation: "VALIDATION",
  NotFound: "NOT_FOUND",
  Conflict: "CONFLICT",
  FxUnavailable: "FX_UNAVAILABLE",
  Internal: "INTERNAL",
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};
