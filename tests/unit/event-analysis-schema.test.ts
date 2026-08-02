import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isDuplicateSuggestionTitle,
  parseAnalysisResponse,
} from "../../src/server/services/event-analysis-schema";
import {
  EventAiReportType,
  EventSpendingCategory,
} from "../../src/types/enums";

const knownIds = new Set(["item-1", "item-2"]);
const knownTitles = new Set(["Water", "Bread", "Disposable cups"]);

describe("parseAnalysisResponse", () => {
  it("accepts a valid ok report with no item suggestions", () => {
    const result = parseAnalysisResponse(
      JSON.stringify({
        event_report_type: "ok",
        report_message: "Looks fine.",
        items_report: {},
        suggested_items: [],
      }),
      knownIds,
      knownTitles,
    );

    assert.equal(result.type, EventAiReportType.Ok);
    assert.equal(result.reportMessage, "Looks fine.");
    assert.deepEqual(result.items, []);
    assert.deepEqual(result.suggestedItems, []);
  });

  it("keeps only known item ids and drops empty suggestions", () => {
    const result = parseAnalysisResponse(
      JSON.stringify({
        event_report_type: "bad",
        report_message: "## Bad list",
        items_report: {
          "item-1": {
            message: "Too little water",
            better_amount: 10,
            realistic_price: null,
          },
          "item-ghost": {
            message: "Unknown",
            better_amount: 1,
            realistic_price: 2,
          },
          "item-2": {
            message: "No change",
            better_amount: null,
            realistic_price: null,
          },
        },
      }),
      knownIds,
      knownTitles,
    );

    assert.equal(result.type, EventAiReportType.Bad);
    assert.equal(result.items.length, 1);
    assert.deepEqual(result.items[0], {
      itemId: "item-1",
      message: "Too little water",
      betterAmount: 10,
      realisticPrice: null,
    });
  });

  it("accepts string amounts, markdown fences, and array items_report", () => {
    const result = parseAnalysisResponse(
      [
        "Here is the report:",
        "```json",
        JSON.stringify({
          event_report_type: "BAD",
          report_message: "Needs fixes",
          items_report: [
            {
              item_id: "item-1",
              message: "Salt overload",
              better_amount: "2",
              realistic_price: "40",
            },
            {
              id: "item-2",
              message: "Zero amount ignored",
              better_amount: 0,
              realistic_price: "",
            },
          ],
        }),
        "```",
      ].join("\n"),
      knownIds,
      knownTitles,
    );

    assert.equal(result.type, EventAiReportType.Bad);
    assert.equal(result.items.length, 1);
    assert.deepEqual(result.items[0], {
      itemId: "item-1",
      message: "Salt overload",
      betterAmount: 2,
      realisticPrice: 40,
    });
  });

  it("accepts missing items_report and suggested_items", () => {
    const result = parseAnalysisResponse(
      JSON.stringify({
        event_report_type: "ok",
        report_message: "All good",
      }),
      knownIds,
      knownTitles,
    );

    assert.equal(result.type, EventAiReportType.Ok);
    assert.deepEqual(result.items, []);
    assert.deepEqual(result.suggestedItems, []);
  });

  it("parses suggested_items and drops duplicates, invalid categories, and overflow", () => {
    const suggestedItems = [
      {
        title: "Ice",
        category: "drinks",
        amount: "3",
        amount_unit: "кг",
        realistic_price: 50,
        reason: "For cocktails",
      },
      {
        title: "water",
        category: "DRINKS",
        amount: 2,
        amount_unit: "л",
        realistic_price: 40,
        reason: "Duplicate of existing",
      },
      {
        title: "Coal",
        category: "NOT_A_CATEGORY",
        amount: 1,
        amount_unit: "уп",
        realistic_price: 300,
        reason: "Bad category",
      },
      {
        title: "Cups",
        category: "OTHER",
        amount: 20,
        amount_unit: "шт",
        realistic_price: 5,
        reason: "Already listed as Disposable cups",
      },
      {
        title: "одноразовые стаканы",
        category: "OTHER",
        amount: 40,
        amount_unit: "шт",
        realistic_price: 5,
        reason: "RU alias of Disposable cups",
      },
      ...Array.from({ length: 10 }, (_, index) => ({
        title: `Extra ${index}`,
        category: "FOOD",
        amount: 1,
        amount_unit: "шт",
        realistic_price: 10,
        reason: "Filler",
      })),
    ];

    const result = parseAnalysisResponse(
      JSON.stringify({
        event_report_type: "ok",
        report_message: "Suggestions ready",
        suggested_items: suggestedItems,
      }),
      knownIds,
      knownTitles,
    );

    assert.equal(result.suggestedItems.length, 8);
    assert.deepEqual(result.suggestedItems[0], {
      title: "Ice",
      category: EventSpendingCategory.Drinks,
      amount: 3,
      amountUnit: "кг",
      price: 50,
      reason: "For cocktails",
    });
    assert.ok(
      result.suggestedItems.every(
        (item) =>
          item.title.toLocaleLowerCase() !== "water" &&
          item.title.toLocaleLowerCase() !== "cups" &&
          !item.title.toLocaleLowerCase().includes("стакан"),
      ),
    );
  });

  it("treats en/ru cup aliases and token subsets as duplicate titles", () => {
    assert.equal(
      isDuplicateSuggestionTitle("одноразовые стаканы", ["Disposable cups"]),
      true,
    );
    assert.equal(isDuplicateSuggestionTitle("Cups", ["Disposable cups"]), true);
    assert.equal(isDuplicateSuggestionTitle("Ice", ["Disposable cups"]), false);
    assert.equal(isDuplicateSuggestionTitle("Still water", ["Water"]), true);
  });

  it("rejects malformed JSON", () => {
    assert.throws(() => parseAnalysisResponse("{nope", knownIds), {
      message: "AI returned invalid JSON",
    });
  });

  it("rejects an unexpected payload shape", () => {
    assert.throws(
      () =>
        parseAnalysisResponse(
          JSON.stringify({ event_report_type: "maybe" }),
          knownIds,
        ),
      { message: "AI returned an unexpected report shape" },
    );
  });
});
