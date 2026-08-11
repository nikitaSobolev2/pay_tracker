"use client";

import { scheduleTravelOfflineFlush } from "@/lib/offline/offline-flush";
import type { TravelOfflineOp } from "@/stores/travel-offline-queue.types";
import { useTravelOfflineQueueStore } from "@/stores/travel-offline-queue.store";

export { isNetworkError } from "@/lib/offline/travel-offline-execute";

export function enqueueTravelOp(input: {
  travelId: string;
  op: TravelOfflineOp;
  localId?: string;
  /** Pre-change fields; reverting to these drops the pending op. */
  baseline?: Record<string, unknown>;
}): string {
  const localId = input.localId ?? crypto.randomUUID();
  const store = useTravelOfflineQueueStore.getState();
  store.enqueue({
    localId,
    travelId: input.travelId,
    op: input.op,
    baseline: input.baseline,
  });
  scheduleTravelOfflineFlush();
  return localId;
}

export function travelHasPendingOfflineOps(travelId: string): boolean {
  return useTravelOfflineQueueStore.getState().hasPendingForTravel(travelId);
}
