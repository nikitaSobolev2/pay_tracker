import { NextResponse } from "next/server";

import { ApiErrorCode, type ApiErrorBody } from "@/types/api";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(
  code: ApiErrorCode,
  message: string,
  status: number,
) {
  const body: ApiErrorBody = { error: { code, message } };
  return NextResponse.json(body, { status });
}

export function unauthorized(message = "Unauthorized") {
  return jsonError(ApiErrorCode.Unauthorized, message, 401);
}

export function validationError(message: string) {
  return jsonError(ApiErrorCode.Validation, message, 400);
}

export function notFound(message = "Not found") {
  return jsonError(ApiErrorCode.NotFound, message, 404);
}

export function internalError(message = "Internal server error") {
  return jsonError(ApiErrorCode.Internal, message, 500);
}
