import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTicketAnalysisPrompt } from "@/server/services/ticket-analysis-prompt";

describe("buildTicketAnalysisPrompt", () => {
  it("asks the model for a passenger seat token", () => {
    const { systemPrompt } = buildTicketAnalysisPrompt({
      sourceKind: "pdf_text",
      fileName: "ticket.pdf",
      extractedText: "sample",
    });
    assert.match(systemPrompt, /"seat": string \| null/);
    assert.match(systemPrompt, /14A/);
  });
});
