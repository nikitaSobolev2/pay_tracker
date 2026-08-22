export type TravelCacheReconcile = {
  readonly removeFrom: string | null;
  readonly upsertTo: string | null;
};

/** Where a transaction should leave / land when its travel link changes. */
export function reconcileTravelTransactionCache(input: {
  readonly previousTravelId: string | null;
  readonly nextTravelId: string | null;
}): TravelCacheReconcile {
  if (input.previousTravelId === input.nextTravelId) {
    return {
      removeFrom: null,
      upsertTo: input.nextTravelId,
    };
  }
  return {
    removeFrom: input.previousTravelId,
    upsertTo: input.nextTravelId,
  };
}
