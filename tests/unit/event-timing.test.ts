import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isEventHeaderRelevant,
  pickNearestUpcomingEvent,
  resolveAutoEventPhase,
  resolveEventPhase,
} from "@/lib/event-timing";
import { EventPhase } from "@/types/enums";

describe("resolveEventPhase", () => {
  const now = new Date("2026-08-09T12:00:00.000Z");

  it("marks future start as pending", () => {
    assert.equal(
      resolveAutoEventPhase("2026-08-10T18:00:00.000Z", null, now),
      EventPhase.Pending,
    );
  });

  it("marks active range as in progress", () => {
    assert.equal(
      resolveAutoEventPhase(
        "2026-08-09T10:00:00.000Z",
        "2026-08-09T20:00:00.000Z",
        now,
      ),
      EventPhase.InProgress,
    );
  });

  it("marks past end as finished", () => {
    assert.equal(
      resolveAutoEventPhase(
        "2026-08-01T10:00:00.000Z",
        "2026-08-01T20:00:00.000Z",
        now,
      ),
      EventPhase.Finished,
    );
  });

  it("uses override when present", () => {
    assert.equal(
      resolveEventPhase({
        occursAt: "2026-08-10T18:00:00.000Z",
        endsAt: null,
        phaseOverride: EventPhase.Canceled,
        now,
      }),
      EventPhase.Canceled,
    );
  });
});

describe("isEventHeaderRelevant", () => {
  const now = new Date("2026-08-09T12:00:00.000Z");

  it("hides canceled events", () => {
    assert.equal(
      isEventHeaderRelevant({
        occursAt: "2026-08-10T18:00:00.000Z",
        endsAt: null,
        phaseOverride: EventPhase.Canceled,
        now,
      }),
      false,
    );
  });

  it("hides finished events from the header", () => {
    assert.equal(
      isEventHeaderRelevant({
        occursAt: "2026-08-01T10:00:00.000Z",
        endsAt: "2026-08-01T20:00:00.000Z",
        now,
      }),
      false,
    );
  });

  it("keeps pending events", () => {
    assert.equal(
      isEventHeaderRelevant({
        occursAt: "2026-08-10T18:00:00.000Z",
        endsAt: null,
        now,
      }),
      true,
    );
  });

  it("keeps an in-progress override after the end date", () => {
    assert.equal(
      isEventHeaderRelevant({
        occursAt: "2026-08-01T10:00:00.000Z",
        endsAt: "2026-08-01T20:00:00.000Z",
        phaseOverride: EventPhase.InProgress,
        now,
      }),
      true,
    );
  });
});

describe("pickNearestUpcomingEvent", () => {
  const now = new Date("2026-08-09T12:00:00.000Z");

  it("prefers in-progress over later pending", () => {
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

  it("picks soonest pending when none in progress", () => {
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

  it("ignores canceled events even if dates are upcoming", () => {
    const picked = pickNearestUpcomingEvent(
      [
        {
          id: "canceled",
          occursAt: "2026-08-10T18:00:00.000Z",
          endsAt: null,
          phaseOverride: EventPhase.Canceled,
        },
        {
          id: "soon",
          occursAt: "2026-08-12T18:00:00.000Z",
          endsAt: null,
        },
      ],
      now,
    );
    assert.equal(picked?.id, "soon");
  });
});
