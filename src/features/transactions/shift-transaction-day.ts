import {
  addDays,
  endOfMonth,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";

import {
  isSingleDayDatePreset,
  type DateFilterPreset,
} from "@/features/transactions/transaction-filter.types";
import { DateRangeType } from "@/types/enums";

export type DayShiftDirection = "prev" | "next";

export type AbsoluteDayPreset = {
  readonly kind: "absolute";
  readonly startDate: string;
  readonly endDate: string;
};

export type DateKeyBounds = {
  readonly startDate: string;
  readonly endDate: string;
};

function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function parseDateKey(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

/** Local yyyy-MM-dd bounds for a preset, or null for all-time. */
export function datePresetLocalBounds(
  preset: DateFilterPreset,
  today: Date = new Date(),
): DateKeyBounds | null {
  const day = startOfDay(today);
  if (preset.kind === "all_time") {
    return null;
  }
  if (preset.kind === "calendar") {
    if (preset.range === DateRangeType.Day) {
      const key = toDateKey(day);
      return { startDate: key, endDate: key };
    }
    if (preset.range === DateRangeType.Month) {
      return {
        startDate: toDateKey(startOfMonth(day)),
        endDate: toDateKey(endOfMonth(day)),
      };
    }
    return {
      startDate: toDateKey(startOfYear(day)),
      endDate: toDateKey(endOfYear(day)),
    };
  }
  if (preset.kind === "absolute") {
    return { startDate: preset.startDate, endDate: preset.endDate };
  }
  const count = Math.max(1, Math.floor(preset.n));
  if (preset.unit === "days") {
    return {
      startDate: toDateKey(subDays(day, count - 1)),
      endDate: toDateKey(day),
    };
  }
  if (preset.unit === "months") {
    return {
      startDate: toDateKey(subMonths(day, count)),
      endDate: toDateKey(day),
    };
  }
  return {
    startDate: toDateKey(subYears(day, count)),
    endDate: toDateKey(day),
  };
}

function absoluteDay(date: Date): AbsoluteDayPreset {
  const key = toDateKey(date);
  return { kind: "absolute", startDate: key, endDate: key };
}

/**
 * Step the transactions date filter by one calendar day.
 * Multi-day ranges land on the first (next) or last (prev) day, then ±1.
 * All-time has no bounds: next → today, prev → yesterday.
 */
export function shiftTransactionDay(
  preset: DateFilterPreset,
  direction: DayShiftDirection,
  today: Date = new Date(),
): AbsoluteDayPreset {
  const day = startOfDay(today);
  if (preset.kind === "all_time") {
    return absoluteDay(direction === "next" ? day : subDays(day, 1));
  }
  if (isSingleDayDatePreset(preset)) {
    const bounds = datePresetLocalBounds(preset, day);
    const current = bounds
      ? parseDateKey(bounds.startDate)
      : day;
    const shifted =
      direction === "next" ? addDays(current, 1) : subDays(current, 1);
    return absoluteDay(shifted);
  }
  const bounds = datePresetLocalBounds(preset, day);
  if (!bounds) {
    return absoluteDay(direction === "next" ? day : subDays(day, 1));
  }
  const key = direction === "next" ? bounds.startDate : bounds.endDate;
  return { kind: "absolute", startDate: key, endDate: key };
}

/** Save the current range only when leaving a multi-day (or all-time) preset. */
export function restorablePresetAfterLeavingRange(
  current: DateFilterPreset,
): DateFilterPreset | null {
  return isSingleDayDatePreset(current) ? null : current;
}
