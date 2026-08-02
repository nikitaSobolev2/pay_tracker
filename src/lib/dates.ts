import {
  endOfDay,
  endOfMonth,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { DateRangeType } from "@/types/enums";

export type RollingRangeUnit = "days" | "months" | "years";

export type DateBounds = {
  start: Date | null;
  end: Date | null;
};

export function utcDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function nowInTimezone(timezone: string): Date {
  return toZonedTime(new Date(), timezone);
}

export function toUtcFromUserLocal(localDate: Date, timezone: string): Date {
  return fromZonedTime(localDate, timezone);
}

export type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
};

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function getZonedDateTimeParts(
  date: Date,
  timezone: string,
): ZonedDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);

  function read(type: Intl.DateTimeFormatPartTypes): number {
    return Number(parts.find((part) => part.type === type)?.value);
  }

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hours: read("hour"),
    minutes: read("minute"),
  };
}

/** Build a real UTC instant from wall-clock parts in `timezone`. */
export function createUtcFromZonedParts(
  parts: ZonedDateTimeParts,
  timezone: string,
): Date {
  return fromZonedTime(
    new Date(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hours,
      parts.minutes,
      0,
      0,
    ),
    timezone,
  );
}

export function getDateRangeBounds(
  dateRangeType: DateRangeType,
  timezone: string,
  reference = new Date(),
): DateBounds {
  const zonedNow = toZonedTime(reference, timezone);
  if (dateRangeType === DateRangeType.AllTime) {
    return { start: null, end: null };
  }
  if (dateRangeType === DateRangeType.Day) {
    return {
      start: fromZonedTime(startOfDay(zonedNow), timezone),
      end: fromZonedTime(endOfDay(zonedNow), timezone),
    };
  }
  if (dateRangeType === DateRangeType.Month) {
    return {
      start: fromZonedTime(startOfMonth(zonedNow), timezone),
      end: fromZonedTime(endOfMonth(zonedNow), timezone),
    };
  }
  return {
    start: fromZonedTime(startOfYear(zonedNow), timezone),
    end: fromZonedTime(endOfYear(zonedNow), timezone),
  };
}

/** Inclusive rolling window ending today (e.g. last 7 days = today + 6 prior days). */
export function getRollingRangeBounds(
  unit: RollingRangeUnit,
  count: number,
  timezone: string,
  reference = new Date(),
): DateBounds {
  const safeCount = Math.max(1, Math.floor(count));
  const zonedNow = toZonedTime(reference, timezone);
  const end = fromZonedTime(endOfDay(zonedNow), timezone);
  let startLocal: Date;
  if (unit === "days") {
    startLocal = startOfDay(subDays(zonedNow, safeCount - 1));
  } else if (unit === "months") {
    startLocal = startOfDay(subMonths(zonedNow, safeCount));
  } else {
    startLocal = startOfDay(subYears(zonedNow, safeCount));
  }
  return {
    start: fromZonedTime(startLocal, timezone),
    end,
  };
}

/** Inclusive absolute window from YYYY-MM-DD to YYYY-MM-DD in the user timezone. */
export function getAbsoluteRangeBounds(
  startDate: string,
  endDate: string,
  timezone: string,
): DateBounds {
  const [fromDate, toDate] =
    startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
  return {
    start: fromZonedTime(`${fromDate}T00:00:00.000`, timezone),
    end: fromZonedTime(`${toDate}T23:59:59.999`, timezone),
  };
}

export function getPreviousBoundsFromCurrent(bounds: DateBounds): DateBounds {
  if (!bounds.start || !bounds.end) {
    return { start: null, end: null };
  }
  const durationMs = bounds.end.getTime() - bounds.start.getTime();
  const previousEnd = new Date(bounds.start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);
  return { start: previousStart, end: previousEnd };
}

export function getPreviousDateRangeBounds(
  dateRangeType: DateRangeType,
  timezone: string,
  reference = new Date(),
): { start: Date | null; end: Date | null } {
  if (dateRangeType === DateRangeType.AllTime) {
    return { start: null, end: null };
  }
  const zonedNow = toZonedTime(reference, timezone);
  if (dateRangeType === DateRangeType.Day) {
    const prev = subDays(zonedNow, 1);
    return {
      start: fromZonedTime(startOfDay(prev), timezone),
      end: fromZonedTime(endOfDay(prev), timezone),
    };
  }
  if (dateRangeType === DateRangeType.Month) {
    const prev = subMonths(zonedNow, 1);
    return {
      start: fromZonedTime(startOfMonth(prev), timezone),
      end: fromZonedTime(endOfMonth(prev), timezone),
    };
  }
  const prev = subYears(zonedNow, 1);
  return {
    start: fromZonedTime(startOfYear(prev), timezone),
    end: fromZonedTime(endOfYear(prev), timezone),
  };
}

export function daysInRange(start: Date | null, end: Date | null): number {
  if (!start || !end) {
    return 0;
  }
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Days actually elapsed in a range, capping the end at `reference` (now).
 * Used for per-day averages so an in-progress period (e.g. the current month)
 * divides spending by days-so-far instead of the full period length.
 */
export function elapsedDaysInRange(
  start: Date | null,
  end: Date | null,
  reference = new Date(),
): number {
  if (!start || !end) {
    return 0;
  }
  const effectiveEnd = end.getTime() < reference.getTime() ? end : reference;
  const ms = effectiveEnd.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export type ReadableDateKind =
  | "today"
  | "yesterday"
  | "tomorrow"
  | "sameYear"
  | "otherYear";

export type ReadableDateParts = {
  kind: ReadableDateKind;
  weekday: string;
  date: string;
  year: number;
  time: string;
};

type CalendarParts = {
  year: number;
  month: number;
  day: number;
};

export function getReadableDateParts(
  value: string | Date,
  locale: string,
  timezone: string,
  reference = new Date(),
): ReadableDateParts | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const target = getCalendarParts(date, timezone);
  const now = getCalendarParts(reference, timezone);
  const yesterday = shiftCalendarDay(now, -1);
  const tomorrow = shiftCalendarDay(now, 1);

  let kind: ReadableDateKind = "otherYear";
  if (isSameCalendarDay(target, now)) {
    kind = "today";
  } else if (isSameCalendarDay(target, yesterday)) {
    kind = "yesterday";
  } else if (isSameCalendarDay(target, tomorrow)) {
    kind = "tomorrow";
  } else if (target.year === now.year) {
    kind = "sameYear";
  }

  const weekday = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: "short",
  })
    .format(date)
    .replace(/\.$/, "")
    .toLocaleUpperCase(locale);

  return {
    kind,
    weekday,
    date: new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      day: "numeric",
      month: "long",
    }).format(date),
    year: target.year,
    time: new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date),
  };
}

export function isSameZonedDay(
  left: Date,
  right: Date,
  timezone: string,
): boolean {
  return isSameCalendarDay(
    getCalendarParts(left, timezone),
    getCalendarParts(right, timezone),
  );
}

export function formatZonedTime(
  date: Date,
  locale: string,
  timezone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function getCalendarParts(date: Date, timezone: string): CalendarParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function isSameCalendarDay(left: CalendarParts, right: CalendarParts): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day
  );
}

function shiftCalendarDay(parts: CalendarParts, deltaDays: number): CalendarParts {
  const shifted = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + deltaDays),
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}
