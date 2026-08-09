import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTravelAnalysisContext } from "@/server/services/travel-analysis-context";
import { TravelPlannedCategory } from "@/types/enums";

describe("buildTravelAnalysisContext", () => {
  it("splits fixed and flexible totals", () => {
    const context = buildTravelAnalysisContext({
      title: "Trip",
      currency: "RUB",
      placeLabel: "Paris, France",
      placeCountry: "FR",
      placeCity: "Paris",
      startsAt: new Date("2026-08-10T00:00:00.000Z"),
      endsAt: new Date("2026-08-12T00:00:00.000Z"),
      maxSpendingGoal: "10000",
      contextMessage: null,
      items: [
        {
          id: "1",
          title: "Hotel",
          category: TravelPlannedCategory.Housing,
          amount: "4000",
          note: null,
        },
        {
          id: "2",
          title: "Train",
          category: TravelPlannedCategory.TravelExpenses,
          amount: "2000",
          note: null,
        },
        {
          id: "3",
          title: "Food",
          category: TravelPlannedCategory.FoodDrinks,
          amount: "1500",
          note: null,
        },
      ],
    });

    assert.equal(context.tripDays, 3);
    assert.equal(context.fixedTotal, "6000");
    assert.equal(context.flexibleTotal, "1500");
    assert.equal(context.grandTotal, "7500");
  });
});
