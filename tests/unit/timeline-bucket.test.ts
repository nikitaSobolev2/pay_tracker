import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTimelineBucket } from "../../src/lib/timeline-bucket";

describe("resolveTimelineBucket", () => {
  it("uses hours for a single day", () => {
    assert.equal(
      resolveTimelineBucket({
        start: new Date("2026-07-25T00:00:00.000Z"),
        end: new Date("2026-07-25T23:59:59.999Z"),
      }),
      "hour",
    );
  });

  it("uses days for multi-day custom windows (not hours)", () => {
    assert.equal(
      resolveTimelineBucket({
        start: new Date("2026-07-01T00:00:00.000Z"),
        end: new Date("2026-07-14T23:59:59.999Z"),
      }),
      "day",
    );
  });

  it("uses months for ~year-long windows", () => {
    assert.equal(
      resolveTimelineBucket({
        start: new Date("2025-07-25T00:00:00.000Z"),
        end: new Date("2026-07-25T23:59:59.999Z"),
      }),
      "month",
    );
  });

  it("uses years for multi-year custom windows", () => {
    assert.equal(
      resolveTimelineBucket({
        start: new Date("2021-07-25T00:00:00.000Z"),
        end: new Date("2026-07-25T23:59:59.999Z"),
      }),
      "year",
    );
  });

  it("defaults all-time (open bounds) to year granularity", () => {
    assert.equal(
      resolveTimelineBucket({ start: null, end: null }),
      "year",
    );
  });
});
