import { AppServiceError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api";

export function requireOwnedBoard<T extends { userId: string }>(
  row: T | null,
  userId: string,
): T {
  if (!row || row.userId !== userId) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Board not found");
  }
  return row;
}
