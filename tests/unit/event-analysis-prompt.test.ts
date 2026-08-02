import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAnalysisPrompt } from "../../src/server/services/event-analysis-prompt";
import {
  EventAttendanceStatus,
  EventSpendingCategory,
} from "../../src/types/enums";

const minimalContext = {
  title: "Picnic",
  currency: "RUB",
  pricingYear: 2026,
  durationHours: 4,
  location: { address: "Moscow", latitude: 55.75, longitude: 37.62 },
  contextMessage: null,
  attendees: {
    certainAttendeeCount: 3,
    uncertainAttendeeCount: 1,
    totalAttendeeCount: 4,
  },
  items: [
    {
      id: "item-1",
      title: "Bread",
      category: EventSpendingCategory.Food,
      amount: "1",
      amountUnit: "шт",
      price: "50",
      note: null,
    },
  ],
  threadMessages: [] as const,
  chatMessages: [] as const,
  attendanceStatuses: [EventAttendanceStatus.Certain] as const,
};

describe("buildAnalysisPrompt", () => {
  it("locks Russian report skeleton and forbids English section titles", () => {
    const { systemPrompt } = buildAnalysisPrompt({
      context: minimalContext,
      responseLanguage: "ru",
    });

    assert.match(systemPrompt, /Response language: Russian/);
    assert.match(systemPrompt, /## Вердикт/);
    assert.match(systemPrompt, /## Проблемы/);
    assert.match(systemPrompt, /Do not leave English section titles/);
    assert.match(systemPrompt, /NEVER mention OK items in report_message/);
    assert.doesNotMatch(systemPrompt, /## Verdict\n/);
    assert.doesNotMatch(systemPrompt, /## В порядке/);
    assert.doesNotMatch(systemPrompt, /## Дальше/);
  });

  it("keeps English report skeleton for en", () => {
    const { systemPrompt } = buildAnalysisPrompt({
      context: minimalContext,
      responseLanguage: "en",
    });

    assert.match(systemPrompt, /Response language: English/);
    assert.match(systemPrompt, /## Verdict/);
    assert.match(systemPrompt, /## Issues/);
    assert.match(systemPrompt, /NEVER put OK/);
    assert.doesNotMatch(systemPrompt, /## Вердикт/);
    assert.doesNotMatch(systemPrompt, /## Looks fine/);
    assert.doesNotMatch(systemPrompt, /## Next steps/);
  });
});
