import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTravelAnalysisResponse } from "@/server/services/travel-analysis-schema";
import { TravelAiReportType } from "@/types/enums";

describe("parseTravelAnalysisResponse", () => {
  it("parses ok report and filters unknown item ids", () => {
    const parsed = parseTravelAnalysisResponse(
      JSON.stringify({
        travel_report_type: "ok",
        report_message: "## Verdict\nLooks fine",
        goal_status: "under",
        flexible_total_assessment: {
          message: "Flexible spend is realistic",
          suggested_flexible_total: null,
        },
        item_notes: {
          known: { message: "Too high for souvenirs" },
          unknown: { message: "ignore" },
        },
      }),
      new Set(["known"]),
    );

    assert.equal(parsed.type, TravelAiReportType.Ok);
    assert.equal(parsed.goalStatus, "under");
    assert.equal(parsed.itemNotes.length, 1);
    assert.equal(parsed.itemNotes[0]?.itemId, "known");
  });
});
