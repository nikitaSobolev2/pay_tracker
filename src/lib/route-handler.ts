import { ZodError } from "zod";

import {
  internalError,
  jsonError,
  unauthorized,
  validationError,
} from "@/lib/api-response";
import { isAppServiceError } from "@/lib/errors";
import { UnauthorizedError } from "@/lib/session";
import { ApiErrorCode } from "@/types/api";

export function handleRouteError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return unauthorized(error.message);
  }
  if (isAppServiceError(error)) {
    const status = statusForCode(error.code);
    return jsonError(error.code, error.message, status);
  }
  if (error instanceof ZodError) {
    return validationError(error.issues[0]?.message ?? "Validation failed");
  }
  console.error(error);
  return internalError();
}

function statusForCode(code: ApiErrorCode): number {
  if (code === ApiErrorCode.Unauthorized) {
    return 401;
  }
  if (code === ApiErrorCode.Validation) {
    return 400;
  }
  if (code === ApiErrorCode.Forbidden) {
    return 403;
  }
  if (code === ApiErrorCode.NotFound) {
    return 404;
  }
  if (code === ApiErrorCode.Conflict) {
    return 409;
  }
  if (code === ApiErrorCode.FxUnavailable) {
    return 422;
  }
  if (code === ApiErrorCode.RateLimited) {
    return 429;
  }
  return 500;
}
