import { format } from "date-fns";

import {
  DEFAULT_TRANSACTION_FILTERS,
  isDatePresetActive,
  type DateFilterPreset,
  type TransactionFilterState,
} from "@/features/transactions/transaction-filter.types";

export type TravelPeriodMode = "spendings" | "trip" | "custom";

export type TravelFilterDateSource = {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly firstSpendingAt?: string | null;
  readonly lastSpendingAt?: string | null;
  readonly firstTransactionAt?: string | null;
  readonly lastTransactionAt?: string | null;
};

export type TravelFilterDateBounds = {
  readonly tripStartDate: string;
  readonly tripEndDate: string;
  readonly spendingStartDate: string | null;
  readonly spendingEndDate: string | null;
  readonly transactionStartDate: string | null;
  readonly transactionEndDate: string | null;
  readonly spendingsKnown: boolean;
};

let sessionPreviousDatePreset: DateFilterPreset =
  DEFAULT_TRANSACTION_FILTERS.datePreset;

export function readTravelFilterSessionPreset(): DateFilterPreset {
  return sessionPreviousDatePreset;
}

export function writeTravelFilterSessionPreset(
  preset: DateFilterPreset,
): void {
  sessionPreviousDatePreset = preset;
}

export function travelFilterDateBounds(
  travel: TravelFilterDateSource,
): TravelFilterDateBounds {
  const trip = orderedDateKeys(
    isoToDateKey(travel.startsAt),
    isoToDateKey(travel.endsAt),
  );
  const spendingsKnown = spendingBoundsKnown(travel);
  const spending = dateKeysFromIsoPair(
    travel.firstSpendingAt,
    travel.lastSpendingAt,
  );
  const transaction = dateKeysFromIsoPair(
    travel.firstTransactionAt,
    travel.lastTransactionAt,
  );
  return {
    tripStartDate: trip.startDate,
    tripEndDate: trip.endDate,
    spendingStartDate: spending?.startDate ?? null,
    spendingEndDate: spending?.endDate ?? null,
    transactionStartDate: transaction?.startDate ?? null,
    transactionEndDate: transaction?.endDate ?? null,
    spendingsKnown,
  };
}

export function defaultTravelDatePreset(
  bounds: TravelFilterDateBounds,
): DateFilterPreset {
  return travelDatePresetForMode(bounds, "spendings");
}

export function travelDatePresetForMode(
  bounds: TravelFilterDateBounds,
  mode: Exclude<TravelPeriodMode, "custom">,
): DateFilterPreset {
  if (mode === "spendings" && bounds.spendingStartDate && bounds.spendingEndDate) {
    return {
      kind: "absolute",
      startDate: bounds.spendingStartDate,
      endDate: bounds.spendingEndDate,
    };
  }
  return {
    kind: "absolute",
    startDate: bounds.tripStartDate,
    endDate: bounds.tripEndDate,
  };
}

export function travelPeriodMode(
  preset: DateFilterPreset,
  bounds: TravelFilterDateBounds,
): TravelPeriodMode {
  if (preset.kind === "rolling") {
    return "custom";
  }
  if (preset.kind !== "absolute") {
    return "spendings";
  }
  const spending = travelDatePresetForMode(bounds, "spendings");
  if (isDatePresetActive(preset, spending) && bounds.spendingStartDate) {
    return "spendings";
  }
  if (isDatePresetActive(preset, travelDatePresetForMode(bounds, "trip"))) {
    return "trip";
  }
  return "custom";
}

export function travelPickerDateKeys(
  bounds: TravelFilterDateBounds | null,
): { readonly startDate: string; readonly endDate: string } | null {
  if (!bounds) {
    return null;
  }
  const starts = [
    bounds.tripStartDate,
    bounds.transactionStartDate,
    bounds.spendingStartDate,
  ].filter((value): value is string => Boolean(value));
  const ends = [
    bounds.tripEndDate,
    bounds.transactionEndDate,
    bounds.spendingEndDate,
  ].filter((value): value is string => Boolean(value));
  if (starts.length === 0 || ends.length === 0) {
    return null;
  }
  return {
    startDate: starts.reduce((earliest, value) =>
      value < earliest ? value : earliest,
    ),
    endDate: ends.reduce((latest, value) => (value > latest ? value : latest)),
  };
}

export function clampDateKeysToRange(
  startDate: string,
  endDate: string,
  limit: { readonly startDate: string; readonly endDate: string },
): { readonly startDate: string; readonly endDate: string } {
  const start = startDate < limit.startDate ? limit.startDate : startDate;
  const end = endDate > limit.endDate ? limit.endDate : endDate;
  if (start <= end) {
    return { startDate: start, endDate: end };
  }
  return limit;
}

export function travelDefaultPresetIfNeeded(
  preset: DateFilterPreset,
  bounds: TravelFilterDateBounds,
): DateFilterPreset | null {
  if (!bounds.spendingsKnown || preset.kind === "absolute") {
    return null;
  }
  return defaultTravelDatePreset(bounds);
}

export function withTravelFilter(
  filters: TransactionFilterState,
  travelId: string | null,
  bounds: TravelFilterDateBounds | null,
  previousDatePreset: DateFilterPreset,
): {
  readonly filters: TransactionFilterState;
  readonly previousDatePreset: DateFilterPreset;
} {
  if (!travelId) {
    return {
      filters: {
        ...filters,
        travelId: null,
        datePreset: previousDatePreset,
      },
      previousDatePreset,
    };
  }
  const nextPrevious =
    filters.travelId == null ? filters.datePreset : previousDatePreset;
  return {
    filters: {
      ...filters,
      travelId,
      datePreset:
        bounds?.spendingsKnown
          ? defaultTravelDatePreset(bounds)
          : filters.datePreset,
    },
    previousDatePreset: nextPrevious,
  };
}

function spendingBoundsKnown(travel: TravelFilterDateSource): boolean {
  return (
    travel.firstSpendingAt !== undefined && travel.lastSpendingAt !== undefined
  );
}

function dateKeysFromIsoPair(
  firstIso: string | null | undefined,
  lastIso: string | null | undefined,
): { readonly startDate: string; readonly endDate: string } | null {
  if (!firstIso || !lastIso) {
    return null;
  }
  return orderedDateKeys(isoToDateKey(firstIso), isoToDateKey(lastIso));
}

function isoToDateKey(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd");
}

function orderedDateKeys(
  left: string,
  right: string,
): { readonly startDate: string; readonly endDate: string } {
  if (left <= right) {
    return { startDate: left, endDate: right };
  }
  return { startDate: right, endDate: left };
}
