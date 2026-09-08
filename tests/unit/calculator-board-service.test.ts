import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AppServiceError } from "../../src/lib/errors";
import { requireOwnedBoard } from "../../src/server/services/calculator-board-ownership";
import { ApiErrorCode } from "../../src/types/api";

describe("requireOwnedBoard", () => {
  it("returns the row when the user owns it", () => {
    const row = { id: "b1", userId: "u1" };
    assert.equal(requireOwnedBoard(row, "u1"), row);
  });

  it("rejects another user's row", () => {
    assert.throws(
      () => requireOwnedBoard({ userId: "u2" }, "u1"),
      (error: unknown) =>
        error instanceof AppServiceError &&
        error.code === ApiErrorCode.NotFound,
    );
  });

  it("rejects a missing row", () => {
    assert.throws(
      () => requireOwnedBoard(null, "u1"),
      (error: unknown) =>
        error instanceof AppServiceError &&
        error.code === ApiErrorCode.NotFound,
    );
  });
});
