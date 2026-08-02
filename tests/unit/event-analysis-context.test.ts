import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAnalysisContext,
  calculateDurationHours,
} from "../../src/server/services/event-analysis-context";
import {
  EventAttendanceStatus,
  EventSpendingCategory,
} from "../../src/types/enums";

describe("calculateDurationHours", () => {
  it("returns hours between start and end, rounded to two decimals", () => {
    assert.equal(
      calculateDurationHours(
        "2026-08-02T10:00:00.000Z",
        "2026-08-02T13:30:00.000Z",
      ),
      3.5,
    );
  });

  it("returns null when there is no end", () => {
    assert.equal(calculateDurationHours("2026-08-02T10:00:00.000Z", null), null);
  });
});

describe("buildAnalysisContext", () => {
  it("maps items, headcounts, location, threads and chat for the prompt", () => {
    const context = buildAnalysisContext(
      {
        title: "Picnic",
        occursAt: "2026-08-02T10:00:00.000Z",
        endsAt: "2026-08-02T14:00:00.000Z",
        currency: "RUB",
        address: "Park",
        latitude: 56.8,
        longitude: 53.2,
        contextMessage: "  kids party  ",
        items: [
          {
            id: "item-1",
            title: "Water",
            category: EventSpendingCategory.Drinks,
            amount: "2",
            amountUnit: "л",
            price: "50",
            note: null,
          },
        ],
        attendees: [
          { status: EventAttendanceStatus.Certain },
          { status: EventAttendanceStatus.Certain },
          { status: EventAttendanceStatus.Uncertain },
        ],
        threadMessages: [
          {
            spendingId: "item-1",
            body: "Too little water",
            authorName: "Clara",
            createdAt: "2026-08-01T12:00:00.000Z",
            isAiGenerated: false,
          },
        ],
        chatMessages: [
          {
            body: "Bring cups",
            authorName: "Nikita",
            createdAt: "2026-08-01T13:00:00.000Z",
          },
        ],
      },
      { pricingYear: 2026 },
    );

    assert.equal(context.pricingYear, 2026);
    assert.equal(context.durationHours, 4);
    assert.equal(context.attendeeCount, 3);
    assert.equal(context.certainAttendeeCount, 2);
    assert.equal(context.contextMessage, "kids party");
    assert.deepEqual(context.items[0], {
      id: "item-1",
      title: "Water",
      category: EventSpendingCategory.Drinks,
      amount: "2",
      amountUnit: "л",
      price: "50",
      total: "100.00",
      note: null,
    });
    assert.equal(context.threadMessagesByItemId["item-1"]?.length, 1);
    assert.equal(context.chatMessages[0]?.body, "Bring cups");
  });
});
