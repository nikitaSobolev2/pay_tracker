import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTravelAnalysisResponse } from "@/server/services/travel-analysis-schema";
import { TravelAiReportType } from "@/types/enums";

describe("parseTravelAnalysisResponse", () => {
  it("parses ok report and filters unknown item ids", () => {
    const parsed = parseTravelAnalysisResponse(
      JSON.stringify({
        travel_report_type: "ok",
        report_message:
          "## Verdict\n> Plan looks realistic for 7 days in Saint Petersburg.\n\n## Snapshot\n- 7 days, RUB 120000 total, flexible 40000.\n\n## Flexible plan\n- Food budget is enough at about 4000/day.\n\n## Goal\n- under: grand total stays below 150000.",
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

  it("rejects empty skeleton-only report messages", () => {
    assert.throws(
      () =>
        parseTravelAnalysisResponse(
          JSON.stringify({
            travel_report_type: "bad",
            report_message:
              "## Вердикт\n## Снимок\n- дни / место / лимит\n- фиксированные vs гибкие\n## Гибкий план\n- только проблемы\n## Лимит\n- under / tight / over / no_goal",
            goal_status: "over",
          }),
          new Set(),
        ),
      /empty report outline/i,
    );
  });
});
