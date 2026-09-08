"use client";

import { useEffect, useMemo } from "react";

import type { TransactionFilterState } from "@/features/transactions/transaction-filter.types";
import { useTransactionFormLookupStore } from "@/stores/transaction-form-lookup.store";

import {
  readTravelFilterSessionPreset,
  travelDefaultPresetIfNeeded,
  travelFilterDateBounds,
  withTravelFilter,
  writeTravelFilterSessionPreset,
  type TravelFilterDateBounds,
} from "./travel-filter-date-range";

export function useTravelFilterPeriod(
  filters: TransactionFilterState,
  onChange: (next: TransactionFilterState) => void,
): {
  readonly travelBounds: TravelFilterDateBounds | null;
  readonly changeTravelId: (travelId: string | null) => void;
} {
  const travels = useTransactionFormLookupStore((state) => state.travels);
  const selectedTravel = filters.travelId
    ? (travels.find((travel) => travel.id === filters.travelId) ?? null)
    : null;
  const travelBounds = useMemo(
    () => (selectedTravel ? travelFilterDateBounds(selectedTravel) : null),
    [selectedTravel],
  );

  useEffect(() => {
    if (!filters.travelId || !travelBounds) {
      return;
    }
    const nextPreset = travelDefaultPresetIfNeeded(
      filters.datePreset,
      travelBounds,
    );
    if (!nextPreset) {
      return;
    }
    onChange({ ...filters, datePreset: nextPreset });
  }, [filters, onChange, travelBounds]);

  function changeTravelId(travelId: string | null) {
    const travel = travelId
      ? (travels.find((item) => item.id === travelId) ?? null)
      : null;
    const nextBounds = travel ? travelFilterDateBounds(travel) : null;
    const result = withTravelFilter(
      filters,
      travelId,
      nextBounds,
      readTravelFilterSessionPreset(),
    );
    writeTravelFilterSessionPreset(result.previousDatePreset);
    onChange(result.filters);
  }

  return { travelBounds, changeTravelId };
}
