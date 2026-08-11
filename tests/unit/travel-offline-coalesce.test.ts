import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { coalesceTravelQueueItems } from "@/lib/offline/travel-offline-coalesce";
import type { TravelOfflineQueueItem } from "@/stores/travel-offline-queue.types";
import { FastQueueStatus, TravelPlannedCategory } from "@/types/enums";

function item(
  partial: Omit<TravelOfflineQueueItem, "createdAtLocal" | "status"> & {
    createdAtLocal?: string;
    status?: FastQueueStatus;
  },
): TravelOfflineQueueItem {
  return {
    createdAtLocal: partial.createdAtLocal ?? "2026-08-12T00:00:00.000Z",
    status: partial.status ?? FastQueueStatus.Pending,
    ...partial,
  };
}

describe("coalesceTravelQueueItems", () => {
  it("drops planned amount update when reverted to baseline", () => {
    const first = item({
      localId: "a",
      travelId: "t1",
      op: {
        kind: "updatePlanned",
        entityId: "p1",
        body: { amount: "200" },
      },
      baseline: { amount: "100" },
    });
    const afterChange = coalesceTravelQueueItems([], first, new Set());
    assert.equal(afterChange.length, 1);

    const revert = item({
      localId: "b",
      travelId: "t1",
      op: {
        kind: "updatePlanned",
        entityId: "p1",
        body: { amount: "100" },
      },
      baseline: { amount: "200" },
    });
    const afterRevert = coalesceTravelQueueItems(
      afterChange,
      revert,
      new Set(),
    );
    assert.equal(afterRevert.length, 0);
  });

  it("drops category budget upsert when amount restored", () => {
    const first = item({
      localId: "a",
      travelId: "t1",
      op: {
        kind: "upsertCategoryBudget",
        category: TravelPlannedCategory.FoodDrinks,
        amount: "500",
      },
      baseline: { amount: null },
    });
    const queued = coalesceTravelQueueItems([], first, new Set());
    const clear = item({
      localId: "b",
      travelId: "t1",
      op: {
        kind: "upsertCategoryBudget",
        category: TravelPlannedCategory.FoodDrinks,
        amount: null,
      },
      baseline: { amount: "500" },
    });
    assert.equal(
      coalesceTravelQueueItems(queued, clear, new Set()).length,
      0,
    );
  });

  it("keeps net change when amount ends different from baseline", () => {
    const first = item({
      localId: "a",
      travelId: "t1",
      op: {
        kind: "updatePlanned",
        entityId: "p1",
        body: { amount: "200" },
      },
      baseline: { amount: "100" },
    });
    const queued = coalesceTravelQueueItems([], first, new Set());
    const second = item({
      localId: "b",
      travelId: "t1",
      op: {
        kind: "updatePlanned",
        entityId: "p1",
        body: { amount: "300" },
      },
      baseline: { amount: "200" },
    });
    const result = coalesceTravelQueueItems(queued, second, new Set());
    assert.equal(result.length, 1);
    assert.equal(result[0]?.op.kind, "updatePlanned");
    if (result[0]?.op.kind === "updatePlanned") {
      assert.equal(result[0].op.body.amount, "300");
    }
    assert.deepEqual(result[0]?.baseline, { amount: "100" });
  });
});
