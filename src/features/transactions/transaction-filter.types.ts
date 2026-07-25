import {
  DateRangeType,
  type TransactionDebtRole,
} from "@/types/enums";

export type RollingRangeUnit = "days" | "months" | "years";

export type DateFilterPreset =
  | {
      kind: "calendar";
      range:
        | typeof DateRangeType.Day
        | typeof DateRangeType.Month
        | typeof DateRangeType.Year;
    }
  | { kind: "all_time" }
  | { kind: "rolling"; unit: RollingRangeUnit; n: number }
  | { kind: "absolute"; startDate: string; endDate: string };

export type TransactionFilterState = {
  datePreset: DateFilterPreset;
  debtRoles: TransactionDebtRole[];
  categoryIds: string[];
  counterpartyIds: string[];
  /** When true, exclude transactions with no categories from list + charts. */
  hideUncategorized: boolean;
};

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilterState = {
  datePreset: { kind: "calendar", range: DateRangeType.Month },
  debtRoles: [],
  categoryIds: [],
  counterpartyIds: [],
  hideUncategorized: false,
};

export function isDatePresetActive(
  current: DateFilterPreset,
  candidate: DateFilterPreset,
): boolean {
  if (current.kind !== candidate.kind) {
    return false;
  }
  if (current.kind === "calendar" && candidate.kind === "calendar") {
    return current.range === candidate.range;
  }
  if (current.kind === "all_time" && candidate.kind === "all_time") {
    return true;
  }
  if (current.kind === "rolling" && candidate.kind === "rolling") {
    return current.unit === candidate.unit && current.n === candidate.n;
  }
  if (current.kind === "absolute" && candidate.kind === "absolute") {
    return (
      current.startDate === candidate.startDate &&
      current.endDate === candidate.endDate
    );
  }
  return false;
}

export function isCustomDatePreset(preset: DateFilterPreset): boolean {
  return preset.kind === "rolling" || preset.kind === "absolute";
}

/** True when the selected window is a single calendar day (avg/day ≡ period total). */
export function isSingleDayDatePreset(preset: DateFilterPreset): boolean {
  if (preset.kind === "calendar") {
    return preset.range === DateRangeType.Day;
  }
  if (preset.kind === "rolling") {
    return preset.unit === "days" && preset.n <= 1;
  }
  if (preset.kind === "absolute") {
    return preset.startDate === preset.endDate;
  }
  return false;
}

/** All-time has no comparable previous window. */
export function supportsPreviousPeriod(preset: DateFilterPreset): boolean {
  return preset.kind !== "all_time";
}

export function datePresetToApiParams(preset: DateFilterPreset): {
  dateRangeType?: (typeof DateRangeType)[keyof typeof DateRangeType];
  rollingUnit?: RollingRangeUnit;
  rollingN?: number;
  startDate?: string;
  endDate?: string;
} {
  if (preset.kind === "all_time") {
    return { dateRangeType: DateRangeType.AllTime };
  }
  if (preset.kind === "calendar") {
    return { dateRangeType: preset.range };
  }
  if (preset.kind === "absolute") {
    return {
      startDate: preset.startDate,
      endDate: preset.endDate,
    };
  }
  return {
    rollingUnit: preset.unit,
    rollingN: preset.n,
  };
}

export function filtersAreDefault(filters: TransactionFilterState): boolean {
  return (
    filters.datePreset.kind === "calendar" &&
    filters.datePreset.range === DateRangeType.Month &&
    filters.debtRoles.length === 0 &&
    filters.categoryIds.length === 0 &&
    filters.counterpartyIds.length === 0 &&
    !filters.hideUncategorized
  );
}
