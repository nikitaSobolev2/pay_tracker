import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { travelIdForFastEnter } from "@/lib/fast-enter-travel";
import { TravelPhase } from "@/types/enums";

describe("travelIdForFastEnter", () => {
  it("returns id when travel is in progress", () => {
    assert.equal(
      travelIdForFastEnter({ id: "t1", phase: TravelPhase.InProgress }),
      "t1",
    );
  });

  it("returns null when travel is preparing", () => {
    assert.equal(
      travelIdForFastEnter({ id: "t1", phase: TravelPhase.Prepares }),
      null,
    );
  });

  it("returns null when travel is finished", () => {
    assert.equal(
      travelIdForFastEnter({ id: "t1", phase: TravelPhase.Finished }),
      null,
    );
  });

  it("returns null when travel is missing", () => {
    assert.equal(travelIdForFastEnter(null), null);
    assert.equal(travelIdForFastEnter(undefined), null);
  });
});
