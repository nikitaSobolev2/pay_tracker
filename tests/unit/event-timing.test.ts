import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  pickNearestUpcomingEvent,
  resolveEventTiming,
} from "@/lib/event-timing";

describe("resolveEventTiming", () => {
  const now = new Date("2026-08-09T12:00:00.000Z");

  it("marks future start as upcoming", () => {
    assert.equal(
      resolveEventTiming({
        occursAt: "2026-08-10T18:00:00.000Z",
        endsAt: null,
        now,
      }),
      "upcoming",
    );
  });

  it("marks active range as in progress", () => {
    assert.equal(
      resolveEventTiming({
        occursAt: "2026-08-09T10:00:00.000Z",
        endsAt: "2026-08-09T20:00:00.000Z",
        now,
      }),
      "inProgress",
    );
  });

  it("marks past end as finished", () => {
    assert.equal(
      resolveEventTiming({
        occursAt: "2026-08-01T10:00:00.000Z",
        endsAt: "2026-08-01T20:00:00.000Z",
        now,
      }),
      "finished",
    );
  });
});

describe("pickNearestUpcomingEvent", () => {
  const now = new Date("2026-08-09T12:00:00.000Z");

  it("prefers in-progress over later upcoming", () => {
    const picked = pickNearestUpcomingEvent(
      [
        {
          id: "later",
          occursAt: "2026-08-15T18:00:00.000Z",
          endsAt: null,
        },
        {
          id: "live",
          occursAt: "2026-08-09T10:00:00.000Z",
          endsAt: "2026-08-09T22:00:00.000Z",
        },
      ],
      now,
    );
    assert.equal(picked?.id, "live");
  });

  it("picks soonest upcoming when none in progress", () => {
    const picked = pickNearestUpcomingEvent(
      [
        {
          id: "far",
          occursAt: "2026-09-01T18:00:00.000Z",
          endsAt: null,
        },
        {
          id: "soon",
          occursAt: "2026-08-10T18:00:00.000Z",
          endsAt: null,
        },
      ],
      now,
    );
    assert.equal(picked?.id, "soon");
  });

  it("returns null when all finished", () => {
    assert.equal(
      pickNearestUpcomingEvent(
        [
          {
            id: "old",
            occursAt: "2026-07-01T18:00:00.000Z",
            endsAt: null,
          },
        ],
        now,
      ),
      null,
    );
  });
});
