import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countTravelDays,
  resolveAutoTravelPhase,
  resolveTravelPhase,
} from "@/lib/travel-phase";
import { TravelPhase } from "@/types/enums";

describe("resolveTravelPhase", () => {
  it("uses override when present", () => {
    const phase = resolveTravelPhase({
      startsAt: "2026-08-10T00:00:00.000Z",
      endsAt: "2026-08-20T00:00:00.000Z",
      phaseOverride: TravelPhase.Failed,
      now: new Date("2026-08-15T12:00:00.000Z"),
    });
    assert.equal(phase, TravelPhase.Failed);
  });

  it("auto-resolves prepares before start", () => {
    assert.equal(
      resolveAutoTravelPhase(
        "2026-08-10T00:00:00.000Z",
        "2026-08-20T00:00:00.000Z",
        new Date("2026-08-09T23:59:59.000Z"),
      ),
      TravelPhase.Prepares,
    );
  });

  it("auto-resolves in progress during range", () => {
    assert.equal(
      resolveAutoTravelPhase(
        "2026-08-10T00:00:00.000Z",
        "2026-08-20T00:00:00.000Z",
        new Date("2026-08-15T12:00:00.000Z"),
      ),
      TravelPhase.InProgress,
    );
  });

  it("auto-resolves finished after end", () => {
    assert.equal(
      resolveAutoTravelPhase(
        "2026-08-10T00:00:00.000Z",
        "2026-08-20T00:00:00.000Z",
        new Date("2026-08-21T00:00:01.000Z"),
      ),
      TravelPhase.Finished,
    );
  });
});

describe("countTravelDays", () => {
  it("counts inclusive days with minimum one", () => {
    assert.equal(
      countTravelDays("2026-08-10T10:00:00.000Z", "2026-08-12T18:00:00.000Z"),
      3,
    );
    assert.equal(
      countTravelDays("2026-08-10T10:00:00.000Z", "2026-08-10T18:00:00.000Z"),
      1,
    );
  });
});
