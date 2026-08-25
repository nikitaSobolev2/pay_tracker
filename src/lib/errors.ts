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
  if (error instanceof AppServiceError) {
    return true;
  }
  return (
    typeof error === "object" &&
    error != null &&
    "name" in error &&
    error.name === "AppServiceError" &&
    "code" in error
  );
}
