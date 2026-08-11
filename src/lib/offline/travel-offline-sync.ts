"use client";

import type { TravelOfflineOp } from "@/stores/travel-offline-queue.types";
import { useTravelOfflineQueueStore } from "@/stores/travel-offline-queue.store";

export { isNetworkError } from "@/lib/offline/travel-offline-execute";

export function enqueueTravelOp(input: {
  travelId: string;
  op: TravelOfflineOp;
  localId?: string;
}): string {
  const localId = input.localId ?? crypto.randomUUID();
  const store = useTravelOfflineQueueStore.getState();
  store.enqueue({
    localId,
    travelId: input.travelId,
    op: input.op,
  });
  void store.retryPending();
  return localId;
}

export function travelHasPendingOfflineOps(travelId: string): boolean {
  return useTravelOfflineQueueStore.getState().hasPendingForTravel(travelId);
}
