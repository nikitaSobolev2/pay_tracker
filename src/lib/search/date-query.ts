import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type ParsedDateRange = {
  readonly start: Date;
  readonly end: Date;
  readonly label: string;
};

type LocalInstant = {
  readonly date: Date;
  /** True when the query included an explicit clock time. */
  readonly hasTime: boolean;
  /** Grain used when expanding a single endpoint into a range half. */
  readonly grain: "day" | "month" | "year";
};

const MONTHS_EN: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const MONTHS_RU: Record<string, number> = {
  январь: 0,
  января: 0,
  янв: 0,
  февраль: 1,
  февраля: 1,
  фев: 1,
  март: 2,
  марта: 2,
  апрель: 3,
  апреля: 3,
  апр: 3,
  май: 4,
  мая: 4,
  июнь: 5,
  июня: 5,
  июн: 5,
  июль: 6,
  июля: 6,
  июл: 6,
  август: 7,
  августа: 7,
  авг: 7,
  сентябрь: 8,
  сентября: 8,
  сен: 8,
  октябрь: 9,
  октября: 9,
  окт: 9,
  ноябрь: 10,
  ноября: 10,
  ноя: 10,
  декабрь: 11,
  декабря: 11,
  дек: 11,
};

const TIME_RE = /(?:\s+|t)(\d{1,2}):(\d{2})$/i;
const RANGE_SEPARATOR_RE = /\s*[-–—]\s*/;
const FROM_TO_RE = /^(?:from|с)\s+(.+?)\s+(?:to|по|до)\s+(.+)$/i;

function zonedNow(timezone: string): Date {
  return toZonedTime(new Date(), timezone);
}

function toUtcBounds(
  localStart: Date,
  localEnd: Date,
  timezone: string,
): { start: Date; end: Date } {
  return {
    start: fromZonedTime(localStart, timezone),
    end: fromZonedTime(localEnd, timezone),
  };
}

function resolveMonth(token: string): number | null {
  const key = token.toLowerCase();
  if (key in MONTHS_EN) {
    return MONTHS_EN[key]!;
  }
  if (key in MONTHS_RU) {
    return MONTHS_RU[key]!;
  }
  return null;
}

function splitTime(raw: string): {
  head: string;
  hours: number | null;
  minutes: number | null;
} {
  const match = raw.trim().match(TIME_RE);
  if (!match) {
    return { head: raw.trim(), hours: null, minutes: null };
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours > 23 ||
    minutes > 59
  ) {
    return { head: raw.trim(), hours: null, minutes: null };
  }
  return {
    head: raw.trim().slice(0, match.index).trim(),
    hours,
    minutes,
  };
}

function withParsedTime(
  date: Date,
  hours: number | null,
  minutes: number | null,
  grain: LocalInstant["grain"],
): LocalInstant {
  if (hours === null || minutes === null) {
    return { date, hasTime: false, grain };
  }
  return {
    date: new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hours,
      minutes,
      0,
      0,
    ),
    hasTime: true,
    grain: "day",
  };
}

function parseAbsoluteEndpoint(raw: string): LocalInstant | null {
  const { head, hours, minutes } = splitTime(raw);
  if (!head) {
    return null;
  }

  const isoDay = head.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDay) {
    const date = new Date(
      Number(isoDay[1]),
      Number(isoDay[2]) - 1,
      Number(isoDay[3]),
      0,
      0,
      0,
      0,
    );
    return withParsedTime(date, hours, minutes, "day");
  }

  const dotted = head.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dotted) {
    const date = new Date(
      Number(dotted[3]),
      Number(dotted[2]) - 1,
      Number(dotted[1]),
      0,
      0,
      0,
      0,
    );
    return withParsedTime(date, hours, minutes, "day");
  }

  // 2024-07 (year-month)
  const isoMonth = head.match(/^(\d{4})-(\d{2})$/);
  if (isoMonth && hours === null) {
    const year = Number(isoMonth[1]);
    const month = Number(isoMonth[2]) - 1;
    if (month >= 0 && month <= 11) {
      return {
        date: new Date(year, month, 1, 0, 0, 0, 0),
        hasTime: false,
        grain: "month",
      };
    }
  }

  // July 25 2026 / 25 July 2026 / 25 июля 2026
  const monthDayYear = head.match(
    /^([a-zа-яё]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i,
  );
  if (monthDayYear) {
    const month = resolveMonth(monthDayYear[1]!);
    const day = Number(monthDayYear[2]);
    const year = Number(monthDayYear[3]);
    if (month !== null && day >= 1 && day <= 31) {
      return withParsedTime(
        new Date(year, month, day, 0, 0, 0, 0),
        hours,
        minutes,
        "day",
      );
    }
  }

  const dayMonthYear = head.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zа-яё]+)\s+(\d{4})$/i,
  );
  if (dayMonthYear) {
    const day = Number(dayMonthYear[1]);
    const month = resolveMonth(dayMonthYear[2]!);
    const year = Number(dayMonthYear[3]);
    if (month !== null && day >= 1 && day <= 31) {
      return withParsedTime(
        new Date(year, month, day, 0, 0, 0, 0),
        hours,
        minutes,
        "day",
      );
    }
  }

  // July 2024 / июль 2024
  const monthYear = head.match(/^([a-zа-яё]+)\s+(\d{4})$/i);
  if (monthYear && hours === null) {
    const month = resolveMonth(monthYear[1]!);
    const year = Number(monthYear[2]);
    if (month !== null) {
      return {
        date: new Date(year, month, 1, 0, 0, 0, 0),
        hasTime: false,
        grain: "month",
      };
    }
  }

  // Bare year
  if (/^(19|20)\d{2}$/.test(head) && hours === null) {
    const year = Number(head);
    return {
      date: new Date(year, 0, 1, 0, 0, 0, 0),
      hasTime: false,
      grain: "year",
    };
  }

  return null;
}

function expandStart(instant: LocalInstant): Date {
  if (instant.hasTime) {
    return instant.date;
  }
  if (instant.grain === "year") {
    return startOfYear(instant.date);
  }
  if (instant.grain === "month") {
    return startOfMonth(instant.date);
  }
  return startOfDay(instant.date);
}

function expandEnd(instant: LocalInstant): Date {
  if (instant.hasTime) {
    return instant.date;
  }
  if (instant.grain === "year") {
    return endOfYear(instant.date);
  }
  if (instant.grain === "month") {
    return endOfMonth(instant.date);
  }
  return endOfDay(instant.date);
}

function rangeFromEndpoints(
  startInstant: LocalInstant,
  endInstant: LocalInstant,
  timezone: string,
  label: string,
): ParsedDateRange | null {
  let startLocal = expandStart(startInstant);
  let endLocal = expandEnd(endInstant);
  if (startLocal.getTime() > endLocal.getTime()) {
    const swappedStart = expandStart(endInstant);
    const swappedEnd = expandEnd(startInstant);
    startLocal = swappedStart;
    endLocal = swappedEnd;
  }
  const bounds = toUtcBounds(startLocal, endLocal, timezone);
  return { ...bounds, label };
}

function tryParseRangePair(
  leftRaw: string,
  rightRaw: string,
  timezone: string,
  label: string,
): ParsedDateRange | null {
  const left = parseAbsoluteEndpoint(leftRaw);
  const right = parseAbsoluteEndpoint(rightRaw);
  if (!left || !right) {
    return null;
  }
  return rangeFromEndpoints(left, right, timezone, label);
}

/**
 * Split `a-b` style ranges without breaking ISO dates like 2024-07-25.
 */
function splitDashRange(q: string): [string, string] | null {
  // Explicit ISO day – ISO day (no spaces required).
  const isoPair = q.match(
    /^(\d{4}-\d{2}-\d{2}(?:[ t]\d{1,2}:\d{2})?)\s*[-–—]\s*(\d{4}-\d{2}-\d{2}(?:[ t]\d{1,2}:\d{2})?)$/i,
  );
  if (isoPair) {
    return [isoPair[1]!, isoPair[2]!];
  }

  // Month year – year  (July 2024-2025 / july 2024 - 2025)
  const monthYearToYear = q.match(
    /^([a-zа-яё]+)\s+(\d{4})\s*[-–—]\s*((?:19|20)\d{2})$/i,
  );
  if (monthYearToYear) {
    return [
      `${monthYearToYear[1]} ${monthYearToYear[2]}`,
      monthYearToYear[3]!,
    ];
  }

  // Year – year
  const yearPair = q.match(/^((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2})$/);
  if (yearPair) {
    return [yearPair[1]!, yearPair[2]!];
  }

  // Generic: split on the last range separator where both sides parse.
  const parts = q.split(RANGE_SEPARATOR_RE);
  if (parts.length < 2) {
    return null;
  }

  for (let index = 1; index < parts.length; index += 1) {
    const left = parts.slice(0, index).join("-").trim();
    const right = parts.slice(index).join("-").trim();
    if (!left || !right) {
      continue;
    }
    if (parseAbsoluteEndpoint(left) && parseAbsoluteEndpoint(right)) {
      return [left, right];
    }
  }

  return null;
}

function parseRelativeKeywords(
  q: string,
  timezone: string,
  label: string,
): ParsedDateRange | null {
  const nowLocal = zonedNow(timezone);

  if (q === "today" || q === "сегодня") {
    return {
      ...toUtcBounds(startOfDay(nowLocal), endOfDay(nowLocal), timezone),
      label,
    };
  }

  if (q === "yesterday" || q === "вчера") {
    const day = subDays(nowLocal, 1);
    return {
      ...toUtcBounds(startOfDay(day), endOfDay(day), timezone),
      label,
    };
  }

  if (
    q === "this week" ||
    q === "эта неделя" ||
    q === "эту неделю" ||
    q === "на этой неделе"
  ) {
    return {
      ...toUtcBounds(
        startOfWeek(nowLocal, { weekStartsOn: 1 }),
        endOfWeek(nowLocal, { weekStartsOn: 1 }),
        timezone,
      ),
      label,
    };
  }

  if (
    q === "this month" ||
    q === "этот месяц" ||
    q === "этом месяце" ||
    q === "в этом месяце"
  ) {
    return {
      ...toUtcBounds(startOfMonth(nowLocal), endOfMonth(nowLocal), timezone),
      label,
    };
  }

  return null;
}

/**
 * Parse natural-language / structured date queries in EN and RU.
 * Returns null when the query is not a date expression.
 */
export function parseSearchDateQuery(
  raw: string,
  timezone: string,
): ParsedDateRange | null {
  const label = raw.trim();
  const q = label.toLowerCase().replace(/\s+/g, " ");
  if (!q) {
    return null;
  }

  const relative = parseRelativeKeywords(q, timezone, label);
  if (relative) {
    return relative;
  }

  const fromTo = q.match(FROM_TO_RE);
  if (fromTo) {
    const ranged = tryParseRangePair(
      fromTo[1]!.trim(),
      fromTo[2]!.trim(),
      timezone,
      label,
    );
    if (ranged) {
      return ranged;
    }
  }

  const dashParts = splitDashRange(q);
  if (dashParts) {
    const ranged = tryParseRangePair(
      dashParts[0],
      dashParts[1],
      timezone,
      label,
    );
    if (ranged) {
      return ranged;
    }
  }

  const single = parseAbsoluteEndpoint(q);
  if (!single) {
    return null;
  }

  // Single datetime: from that instant through end of its day.
  if (single.hasTime) {
    return {
      ...toUtcBounds(single.date, endOfDay(single.date), timezone),
      label,
    };
  }

  return {
    ...toUtcBounds(expandStart(single), expandEnd(single), timezone),
    label,
  };
}
