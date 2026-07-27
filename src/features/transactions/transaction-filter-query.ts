import {
  DEFAULT_TRANSACTION_FILTERS,
  isDatePresetActive,
  type DateFilterPreset,
  type RollingRangeUnit,
  type TransactionFilterState,
} from "@/features/transactions/transaction-filter.types";
import {
  DateRangeType,
  TransactionKind,
  type TransactionKind as TransactionKindValue,
} from "@/types/enums";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const FILTER_PARAM_KEYS = [
  "dateRangeType",
  "rollingUnit",
  "rollingN",
  "startDate",
  "endDate",
  "kinds",
  "categoryIds",
  "counterpartyIds",
  "hideUncategorized",
] as const;

const CALENDAR_RANGES = new Set<string>([
  DateRangeType.Day,
  DateRangeType.Month,
  DateRangeType.Year,
]);

const ROLLING_UNITS = new Set<RollingRangeUnit>(["days", "months", "years"]);

const ALL_KINDS = new Set<string>(Object.values(TransactionKind));

type SearchParamsReader = {
  get(name: string): string | null;
};

/** Builds filter state from URL search params (missing keys → defaults). */
export function filtersFromSearchParams(
  params: SearchParamsReader,
): TransactionFilterState {
  return {
    datePreset: datePresetFromSearchParams(params),
    kinds: parseKinds(params.get("kinds")),
    categoryIds: parseCsv(params.get("categoryIds")),
    counterpartyIds: parseCsv(params.get("counterpartyIds")),
    hideUncategorized: params.get("hideUncategorized") === "true",
  };
}

/** Writes non-default filter values into params (clears previous filter keys). */
export function writeFiltersToSearchParams(
  params: URLSearchParams,
  filters: TransactionFilterState,
): void {
  for (const key of FILTER_PARAM_KEYS) {
    params.delete(key);
  }

  writeDatePreset(params, filters.datePreset);

  if (filters.kinds.length > 0) {
    params.set("kinds", filters.kinds.join(","));
  }
  if (filters.categoryIds.length > 0) {
    params.set("categoryIds", filters.categoryIds.join(","));
  }
  if (filters.counterpartyIds.length > 0) {
    params.set("counterpartyIds", filters.counterpartyIds.join(","));
  }
  if (filters.hideUncategorized) {
    params.set("hideUncategorized", "true");
  }
}

export function filterStatesEqual(
  left: TransactionFilterState,
  right: TransactionFilterState,
): boolean {
  return (
    isDatePresetActive(left.datePreset, right.datePreset) &&
    sameIdList(left.kinds, right.kinds) &&
    sameIdList(left.categoryIds, right.categoryIds) &&
    sameIdList(left.counterpartyIds, right.counterpartyIds) &&
    left.hideUncategorized === right.hideUncategorized
  );
}

function datePresetFromSearchParams(
  params: SearchParamsReader,
): DateFilterPreset {
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  if (isDateKey(startDate) && isDateKey(endDate)) {
    return { kind: "absolute", startDate, endDate };
  }

  const rollingUnit = params.get("rollingUnit");
  const rollingN = parsePositiveInt(params.get("rollingN"));
  if (isRollingUnit(rollingUnit) && rollingN !== null) {
    return { kind: "rolling", unit: rollingUnit, n: rollingN };
  }

  const dateRangeType = params.get("dateRangeType");
  if (dateRangeType === DateRangeType.AllTime) {
    return { kind: "all_time" };
  }
  if (dateRangeType && CALENDAR_RANGES.has(dateRangeType)) {
    return {
      kind: "calendar",
      range: dateRangeType as
        | typeof DateRangeType.Day
        | typeof DateRangeType.Month
        | typeof DateRangeType.Year,
    };
  }

  return DEFAULT_TRANSACTION_FILTERS.datePreset;
}

function writeDatePreset(
  params: URLSearchParams,
  preset: DateFilterPreset,
): void {
  if (preset.kind === "calendar") {
    if (preset.range !== DateRangeType.Month) {
      params.set("dateRangeType", preset.range);
    }
    return;
  }
  if (preset.kind === "all_time") {
    params.set("dateRangeType", DateRangeType.AllTime);
    return;
  }
  if (preset.kind === "rolling") {
    params.set("rollingUnit", preset.unit);
    params.set("rollingN", String(preset.n));
    return;
  }
  params.set("startDate", preset.startDate);
  params.set("endDate", preset.endDate);
}

function parseCsv(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseKinds(raw: string | null): TransactionKindValue[] {
  const parsed = parseCsv(raw).filter((kind): kind is TransactionKindValue =>
    ALL_KINDS.has(kind),
  );
  // Kind filter is a single select — keep the first valid value.
  return parsed.slice(0, 1);
}

function parsePositiveInt(raw: string | null): number | null {
  if (!raw || !/^\d+$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function isDateKey(value: string | null): value is string {
  return value != null && DATE_KEY_PATTERN.test(value);
}

function isRollingUnit(value: string | null): value is RollingRangeUnit {
  return value != null && ROLLING_UNITS.has(value as RollingRangeUnit);
}

function sameIdList(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}
