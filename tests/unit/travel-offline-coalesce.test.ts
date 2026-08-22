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

  it("merges ticket update bodies and keeps the first baseline", () => {
    const first = item({
      localId: "a",
      travelId: "t1",
      op: {
        kind: "updateTicket",
        entityId: "tk1",
        body: { title: "Flight BCN", origin: "BCN" },
      },
      baseline: { title: "Boarding pass", origin: null, seat: "12A" },
    });
    const queued = coalesceTravelQueueItems([], first, new Set());
    const second = item({
      localId: "b",
      travelId: "t1",
      op: {
        kind: "updateTicket",
        entityId: "tk1",
        body: { seat: "7C" },
      },
      baseline: { title: "Flight BCN", origin: "BCN", seat: "12A" },
    });
    const result = coalesceTravelQueueItems(queued, second, new Set());
    assert.equal(result.length, 1);
    assert.equal(result[0]?.op.kind, "updateTicket");
    if (result[0]?.op.kind === "updateTicket") {
      assert.equal(result[0].op.body.title, "Flight BCN");
      assert.equal(result[0].op.body.origin, "BCN");
      assert.equal(result[0].op.body.seat, "7C");
    }
    assert.deepEqual(result[0]?.baseline, {
      title: "Boarding pass",
      origin: null,
      seat: "12A",
    });
  });

  it("drops ticket update when fields revert to baseline", () => {
    const first = item({
      localId: "a",
      travelId: "t1",
      op: {
        kind: "updateTicket",
        entityId: "tk1",
        body: { origin: "LIS", destination: "OPO" },
      },
      baseline: { origin: null, destination: null },
    });
    const queued = coalesceTravelQueueItems([], first, new Set());
    const revert = item({
      localId: "b",
      travelId: "t1",
      op: {
        kind: "updateTicket",
        entityId: "tk1",
        body: { origin: null, destination: null },
      },
      baseline: { origin: "LIS", destination: "OPO" },
    });
    assert.equal(
      coalesceTravelQueueItems(queued, revert, new Set()).length,
      0,
    );
  });
});
