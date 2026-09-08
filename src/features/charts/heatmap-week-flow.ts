import { differenceInCalendarDays } from "date-fns";

import { datePresetLocalBounds } from "@/features/transactions/shift-transaction-day";
import type { DateFilterPreset } from "@/features/transactions/transaction-filter.types";
import { DateRangeType } from "@/types/enums";

const SHORT_HEATMAP_DAYS = 28;

function parseLocalDateKey(key: string): Date | null {
  const date = new Date(`${key}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * GitHub-style columns for month-sized windows; Mon–Sun rows under 28 days.
 */
export function heatmapWeekFlowForRange(
  startDate: string,
  endDate: string,
): "row" | "column" {
  const start = parseLocalDateKey(startDate);
  const end = parseLocalDateKey(endDate);
  if (!start || !end) {
    return "column";
  }
  return differenceInCalendarDays(end, start) < SHORT_HEATMAP_DAYS
    ? "row"
    : "column";
}

export function resolveHeatmapWeekFlow(input: {
  readonly weekFlow?: "column" | "row";
  readonly dataStart?: string;
  readonly dataEnd?: string;
  readonly filterStart?: string;
  readonly filterEnd?: string;
}): "row" | "column" {
  if (input.weekFlow) {
    return input.weekFlow;
  }
  if (input.dataStart && input.dataEnd) {
    return heatmapWeekFlowForRange(input.dataStart, input.dataEnd);
  }
  if (input.filterStart && input.filterEnd) {
    return heatmapWeekFlowForRange(input.filterStart, input.filterEnd);
  }
  return "column";
}

/** Prefer GitHub columns for month/year/all-time; rows for short custom windows. */
export function heatmapWeekFlowForPreset(
  preset: DateFilterPreset,
  today: Date = new Date(),
): "row" | "column" {
  if (preset.kind === "all_time") {
    return "column";
  }
  if (preset.kind === "calendar") {
    return preset.range === DateRangeType.Day ? "row" : "column";
  }
  const bounds = datePresetLocalBounds(preset, today);
  if (!bounds) {
    return "column";
  }
  return heatmapWeekFlowForRange(bounds.startDate, bounds.endDate);
}
