import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DateRangeType } from "../../src/types/enums";
import {
  heatmapWeekFlowForPreset,
  heatmapWeekFlowForRange,
  resolveHeatmapWeekFlow,
} from "../../src/features/charts/heatmap-week-flow";

describe("heatmapWeekFlowForRange", () => {
  it("uses row flow when the span is under 28 days", () => {
    assert.equal(heatmapWeekFlowForRange("2026-09-01", "2026-09-14"), "row");
    assert.equal(heatmapWeekFlowForRange("2026-09-01", "2026-09-01"), "row");
  });

  it("uses column flow when the span is 28 days or more", () => {
    assert.equal(heatmapWeekFlowForRange("2026-09-01", "2026-09-29"), "column");
    assert.equal(heatmapWeekFlowForRange("2026-09-01", "2026-09-30"), "column");
  });
});

describe("resolveHeatmapWeekFlow", () => {
  it("prefers an explicit weekFlow over the loaded range", () => {
    assert.equal(
      resolveHeatmapWeekFlow({
        weekFlow: "row",
        dataStart: "2026-01-01",
        dataEnd: "2026-12-31",
      }),
      "row",
    );
  });

  it("uses the loaded range when weekFlow is omitted", () => {
    assert.equal(
      resolveHeatmapWeekFlow({
        dataStart: "2026-09-01",
        dataEnd: "2026-09-10",
      }),
      "row",
    );
  });
});

describe("heatmapWeekFlowForPreset", () => {
  const today = new Date(2026, 8, 8);

  it("keeps GitHub columns for calendar month, year, and all-time", () => {
    assert.equal(
      heatmapWeekFlowForPreset(
        { kind: "calendar", range: DateRangeType.Month },
        today,
      ),
      "column",
    );
    assert.equal(
      heatmapWeekFlowForPreset(
        { kind: "calendar", range: DateRangeType.Year },
        today,
      ),
      "column",
    );
    assert.equal(
      heatmapWeekFlowForPreset({ kind: "all_time" }, today),
      "column",
    );
  });

  it("uses week rows for a day, short custom range, and last N days", () => {
    assert.equal(
      heatmapWeekFlowForPreset(
        { kind: "calendar", range: DateRangeType.Day },
        today,
      ),
      "row",
    );
    assert.equal(
      heatmapWeekFlowForPreset(
        { kind: "absolute", startDate: "2026-08-12", endDate: "2026-08-31" },
        today,
      ),
      "row",
    );
    assert.equal(
      heatmapWeekFlowForPreset(
        { kind: "rolling", unit: "days", n: 7 },
        today,
      ),
      "row",
    );
  });
});
