import type { ApiErrorCode } from "@/types/api";

export class AppServiceError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "AppServiceError";
    this.code = code;
  }
}

export function isAppServiceError(error: unknown): error is AppServiceError {
  return error instanceof AppServiceError;
}
